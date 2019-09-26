import { disallow } from 'feathers-hooks-common'
import { hooks as coreHooks } from '@kalisio/kdk-core'

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [
      coreHooks.processTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToString(['conditions'])
    ],
    update: disallow(),
    patch: [
      disallow('external'),
      coreHooks.processTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt'])
    ],
    remove: []
  },

  after: {
    all: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt']),
      coreHooks.convertToJson(['conditions'])
    ],
    find: [],
    get: [],
    create: [ hook => {
      hook.service.registerAlert(hook.result)
      return hook
    } ],
    update: [],
    patch: [],
    remove: [ hook => {
      hook.service.unregisterAlert(hook.result)
      return hook
    } ]
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
