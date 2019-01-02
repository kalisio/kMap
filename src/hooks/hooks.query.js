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
    const featureId = (service.options ? service.options.featureId : '')
    const ids = typeof query.$groupBy === 'string'  // Group by matching ID(s), ie single ID or array of field to create a compound ID
        ? { [query.$groupBy]: '$properties.' + query.$groupBy }
        // Aggregated in an accumulator to avoid conflict with feature properties
        : query.$groupBy.reduce((object, id) => Object.assign(object, { [id]: '$properties.' + id }), {})
    let groupBy = { _id: ids }
    // Do we only keep first or last available time ?
    const singleTime = (_.toNumber(query.$limit) === 1)
    if (singleTime) {
      // In this case no need to aggregate on each element we simply keep the first/last feature
      // BUG: according to https://jira.mongodb.org/browse/SERVER-9507 MongoDB is not yet
      // able to optimize this kind of operations to avoid full index scan
      // For now we should restrict it to short time range
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
    let aggregateOptions = {}
    // Check if we could provide a hint to the aggregation when targeting feature ID
    if (featureId && match['properties.' + featureId]) {
      aggregateOptions.hint = { ['properties.' + featureId]: 1 }
    }
    // Ensure we do not mix results with/without relevant element values
    // by separately querying each element then merging
    let aggregatedResults
    await Promise.all(query.$aggregate.map(async element => {
      // Find matching features only
      let pipeline = [ { $match: Object.assign({ ['properties.' + element]: { $exists: true } }, match) } ]
      // Ensure they are ordered by increasing time by default
      pipeline.push({ $sort: query.$sort || { time: 1 } })
      // Keep track of all feature values
      if (singleTime) {
        pipeline.push({ $group: groupBy })
        pipeline.push({ $replaceRoot: { newRoot: '$feature' } })
      } else {
        pipeline.push({ $group: Object.assign({ [element]: { $push: '$properties.' + element } }, groupBy) })
      }
      let elementResults = await collection.aggregate(pipeline, aggregateOptions).toArray()
      // Rearrange data so that we get ordered arrays indexed by element
      elementResults.forEach(result => {
        result.time = { [element]: result.time }
        if (!singleTime) {
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
