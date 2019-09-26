import _ from 'lodash'
import { hooks as coreHooks } from '@kalisio/kdk-core'
import { marshallSpatialQuery, aggregateFeaturesQuery } from '../../hooks'

module.exports = {
  before: {
    all: [coreHooks.marshallTimeQuery, coreHooks.convertObjectIDs(['layer'])],
    find: [coreHooks.marshallComparisonQuery, coreHooks.marshallSortQuery, marshallSpatialQuery, aggregateFeaturesQuery],
    get: [],
    create: [coreHooks.processTimes(['time'])],
    update: [coreHooks.processTimes(['time'])],
    patch: [coreHooks.processTimes(['time'])],
    remove: [coreHooks.marshallComparisonQuery, marshallSpatialQuery]
  },

  after: {
    all: [coreHooks.unprocessTimes(['time'])],
    find: [
      (hook) => {
        const result = hook.result
        // Features are returned as a standard GeoJson collection
        hook.result = {
          type: 'FeatureCollection',
          features: Array.isArray(result) ? result : result.data
        }
        // Copy pagination information so that client can use it anyway
        Object.assign(hook.result, _.pick(result, ['total', 'skip', 'limit']))
      }
    ],
    get: [],
    create: [coreHooks.skipEvents], // Avoid emitting events on feature edition
    update: [coreHooks.skipEvents],
    patch: [coreHooks.skipEvents],
    remove: [coreHooks.skipEvents]
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
}
