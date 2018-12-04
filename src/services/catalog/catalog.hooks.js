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
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
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
