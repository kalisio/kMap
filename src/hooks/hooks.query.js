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
  if (!query) return
  // Perform aggregation
  if (query.$aggregate) {
    const collection = hook.service.Model
    let groupBy = {
      _id: typeof query.$groupBy === 'string'  // Group by matching ID(s)
        ? '$' + query.$groupBy
        : query.$groupBy.reduce((object, id) => Object.assign(object, { [id.replace('properties.', '')]: '$' + id }), {}),
      time: { $push: '$time' },                 // Keep track of all times
      geometry: { $last: '$geometry' },         // geometry is similar for all results, keep last
      type: { $last: '$type' },                 // type is similar for all results, keep last
      properties: { $last: '$properties' }      // properties are similar for all results, keep last
    }
    // The query contains the match stage except options relevent to the aggregation pipeline
    let match = _.omit(query, ['$groupBy', '$aggregate'])
    // Ensure we do not mix results with/without relevant element values
    // by separately querying each element then merging
    let aggregatedResults
    await Promise.all(query.$aggregate.map(async element => {
      let partialResults = await collection.aggregate([
        // Find matching probre results only
        { $match: Object.assign({ ['properties.' + element]: { $exists: true } }, match) },
        // Ensure they are ordered by increasing time
        { $sort: { time: 1 } },
        // Keep track of all element values
        { $group: Object.assign({ [element]: { $push: '$properties.' + element } }, groupBy) }
      ]).toArray()
      // Rearrange data so that we get ordered arrays indexed by element
      partialResults.forEach(result => {
        result.time = { [element]: result.time }
        // Set back the element values as properties because we aggregated in an accumulator
        // to avoid conflict with probe properties
        result.properties[element] = result[element]
        // Delete accumulator
        delete result[element]
      })
      // Now merge
      if (!aggregatedResults) aggregatedResults = partialResults
      else {
        partialResults.forEach(result => {
          let previousResult = aggregatedResults.find(aggregatedResult => aggregatedResult[query.$groupBy] === result[query.$groupBy])
          if (previousResult) {
            Object.assign(previousResult.time, result.time)
            previousResult.properties[element] = result.properties[element]
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
