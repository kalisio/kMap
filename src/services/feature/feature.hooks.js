import _ from 'lodash'
import { hooks as coreHooks } from '@kalisio/kdk-core'
import { marshallSpatialQuery, aggregateFeaturesQuery } from '../../hooks'

module.exports = {
  before: {
    all: [ coreHooks.marshallTimeQuery ],
    find: [ coreHooks.marshallComparisonQuery, marshallSpatialQuery, aggregateFeaturesQuery ],
    get: [],
    create: [ coreHooks.processTime ],
    update: [ coreHooks.processTime ],
    patch: [ coreHooks.processTime ],
    remove: [ coreHooks.marshallComparisonQuery, marshallSpatialQuery ]
  },

  after: {
    all: [ coreHooks.unprocessTime ],
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
    create: [],
    update: [],
    patch: [ ],
    remove: []
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
