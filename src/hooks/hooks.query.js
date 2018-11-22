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
