import { hooks as coreHooks } from '@kalisio/kdk-core'
import { marshallSpatialQuery } from '../../hooks'

module.exports = {
  before: {
    all: [ coreHooks.marshallTimeQuery ],
    find: [ coreHooks.marshallComparisonQuery, marshallSpatialQuery ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [ coreHooks.marshallComparisonQuery, marshallSpatialQuery ]
  },

  after: {
    all: [],
    find: [],
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
