import _ from 'lodash'
import { marshallGeometry } from '../marshall'

export function marshallGeometryQuery (hook) {
  let query = hook.params.query
  if (_.isNil(query)) return
  let geometry = query.geometry
  if (_.isNil(geometry)) return
  marshallGeometry(geometry)
}

export function marshallSpatialQuery (hook) {
  let query = hook.params.query
  if (query) {
    if (!_.isNil(query.geometry)) marshallGeometry(query.geometry)
    // Shortcut for proximity query
    if (!_.isNil(query.centerLon) && !_.isNil(query.centerLat) && !_.isNil(query.distance)) {
      let lon = _.toNumber(query.centerLon)
      let lat = _.toNumber(query.centerLat)
      let d = _.toNumber(query.distance)
      // Transform to MongoDB spatial request
      delete query.centerLon
      delete query.centerLat
      delete query.distance
      query.geometry = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          $maxDistance: d
        }
      }
    }
  }
}

export async function aggregateFeaturesQuery (hook) {
  let query = hook.params.query
  const service = hook.service
  if (!query) return
  // Perform aggregation
  if (query.$aggregate) {
    const collection = service.Model
    const ids = typeof query.$groupBy === 'string'  // Group by matching ID(s), ie single ID or array of field to create a compound ID
        ? { [query.$groupBy]: '$properties.' + query.$groupBy }
        // Aggregated in an accumulator to avoid conflict with feature properties
        : query.$groupBy.reduce((object, id) => Object.assign(object, { [id]: '$properties.' + id }), {})
    let groupBy = { _id: ids }
    // Do we only keep first or last available time ?
    const singleFeature = (query.$limit === 1)
    if (singleFeature) {
      // In this case no need to aggregate on each element we simply keep the first/last feature
      Object.assign(groupBy, { feature: { $first: '$$ROOT' } })
    } else {
      Object.assign(groupBy, {
        time: { $push: '$time' },                 // Keep track of all times
        geometry: { $last: '$geometry' },         // geometry is similar for all results, keep last
        type: { $last: '$type' },                 // type is similar for all results, keep last
        properties: { $last: '$properties' }      // properties are similar for all results, keep last
      })
    }
    // The query contains the match stage except options relevent to the aggregation pipeline
    let match = _.omit(query, ['$groupBy', '$aggregate', '$sort', '$limit', '$skip'])
    // Ensure we do not mix results with/without relevant element values
    // by separately querying each element then merging
    let aggregatedResults
    await Promise.all(query.$aggregate.map(async element => {
      // Find matching features only
      let pipeline = [ { $match: Object.assign({ ['properties.' + element]: { $exists: true } }, match) } ]
      // Ensure they are ordered by increasing time by default
      pipeline.push({ $sort: query.$sort || { time: 1 } })
      // Keep track of all feature values
      if (singleFeature) {
        pipeline.push({ $group: groupBy })
        pipeline.push({ $replaceRoot: { newRoot: '$feature' } })
      } else {
        pipeline.push({ $group: Object.assign({ [element]: { $push: '$properties.' + element } }, groupBy) })
      }
      let elementResults = await collection.aggregate(pipeline).toArray()
      // Rearrange data so that we get ordered arrays indexed by element
      elementResults.forEach(result => {
        result.time = { [element]: result.time }
        if (!singleFeature) {
          // Set back the element values as properties because we aggregated in an accumulator
          // to avoid conflict with feature properties
          result.properties[element] = result[element]
          // Delete accumulator
          delete result[element]
        }
      })
      // Now merge with previous element results
      if (!aggregatedResults) {
        aggregatedResults = elementResults
      } else {
        elementResults.forEach(result => {
          let previousResult = aggregatedResults.find(aggregatedResult => {
            const keys = _.keys(ids)
            return (_.isEqual(_.pick(aggregatedResult, keys), _.pick(result, keys)))
          })
          // Merge with previous matching feature if any
          if (previousResult) {
            Object.assign(previousResult.time, result.time)
            previousResult.properties[element] = result.properties[element]
          } else {
            aggregatedResults.push(result)
          }
        })
      }
    }))
    delete query.$aggregate
    // Set result to avoid service DB call
    hook.result = aggregatedResults
  }
  return hook
}
