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
    if (!_.isNil(query.geomtry)) marshallGeometry(query.geometry)
    // Resampling is used by hooks only, do not send it to DB
    if (!_.isNil(query.oLon) && !_.isNil(query.oLat) && !_.isNil(query.sLon) && !_.isNil(query.sLat) && !_.isNil(query.dLon) && !_.isNil(query.dLat)) {
      // Convert when required from query strings
      hook.params.oLat = _.toNumber(query.oLat)
      hook.params.oLon = _.toNumber(query.oLon)
      hook.params.sLat = _.toNumber(query.sLat)
      hook.params.sLon = _.toNumber(query.sLon)
      hook.params.dLat = _.toNumber(query.dLat)
      hook.params.dLon = _.toNumber(query.dLon)
      delete query.oLat
      delete query.oLon
      delete query.sLat
      delete query.sLon
      delete query.dLat
      delete query.dLon
    }
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

export async function aggregateFeaturesResultQuery (hook) {
  let query = hook.params.query
  if (!query) return
  // Perform aggregation
  if (query.$aggregate) {
    const collection = hook.service.Model
    let groupBy = {
      _id: typeof query.$groupBy === 'string'  // Group by matching ID(s)
        ? '$' + query.$groupBy
        : query.$groupBy.reduce((object, id) => Object.assign(object, { [id.replace('properties.', '')]: '$' + id }), {}),
      time: { $push: '$time' },                 // Keep track of all forecast times
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
