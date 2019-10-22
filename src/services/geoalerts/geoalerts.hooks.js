import { disallow } from 'feathers-hooks-common'
import { hooks as coreHooks } from '@kalisio/kdk-core'
import { asGeoJson, marshallSpatialQuery } from '../../hooks'

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
    remove: []
  },

  after: {
    all: [
      coreHooks.unprocessTimes(['expireAt', 'status.checkedAt', 'status.triggeredAt'])
    ],
    find: [coreHooks.convertToJson(['conditions']), asGeoJson({
      longitudeProperty: 'conditions.geometry.coordinates[0]',
      latitudeProperty: 'conditions.geometry.coordinates[1]',
      pick: ['status.active', 'style', '_id'],
      properties: [{ from: 'status.active', to: 'active' }]
    })],
    get: [coreHooks.convertToJson(['conditions'])],
    create: [coreHooks.convertToJson(['conditions']), hook => hook.service.registerAlert(hook.result)],
    update: [],
    patch: [coreHooks.convertToJson(['conditions'])],
    remove: [coreHooks.convertToJson(['conditions']), hook => hook.service.unregisterAlert(hook.result)]
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
