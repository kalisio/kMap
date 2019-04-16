import { hooks as coreHooks } from '@kalisio/kdk-core'

module.exports = {
  before: {
    all: [],
    find: [ hook => {
      let query = hook.params.query || {}
      // Filter objects according to target type (either layers or services)
      if (query.type) {
        switch (query.type) {
          case 'service':
            // Nothing special todo
            break
          case 'layer':
          default:
            query.type = { $ne: 'service' }
            break
        }
      }
    }],
    get: [],
    create: [ coreHooks.convertObjectIDs(['baseQuery.layer']) ],
    update: [ coreHooks.convertObjectIDs(['baseQuery.layer']) ],
    patch: [ coreHooks.convertObjectIDs(['baseQuery.layer']) ],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [ coreHooks.removeAttachments('schema') ]
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
