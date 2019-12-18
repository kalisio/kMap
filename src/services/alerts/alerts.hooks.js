import _ from 'lodash'
import { disallow } from 'feathers-hooks-common'
import { hooks as coreHooks } from '@kalisio/kdk-core'
import { marshallSpatialQuery } from '../../hooks'

module.exports = {
  before: {
    all: [coreHooks.convertObjectIDs(['feature'])],
    find: [marshallSpatialQuery],
    get: [],
    create: [
      coreHooks.processTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToString(['conditions'])
    ],
    update: disallow(),
    patch: [
      disallow('external'),
      coreHooks.processTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToString(['conditions'])
    ],
    remove: [async hook => await hook.service.unregisterAlert(hook.id)]
  },

  after: {
    all: [],
    find: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions'])
    ],
    get: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions'])
    ],
    create: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions']),
      async hook => await hook.service.registerAlert(hook.result)
    ],
    update: [],
    patch: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions'])
    ],
    remove: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions'])
    ]
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
