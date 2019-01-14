import moment from 'moment'

let featureServiceMixin = {
  methods: {
    async getProbeFeatures (options) {
      return await this.$api.getService(options.probeService).find({})
    },
    async getFeatures (options, queryInterval) {
      // Any base query to process ?
      let baseQuery = {}
      if (options.baseQuery) {
        if (typeof options.baseQuery === 'function') {
          const result = await options.baseQuery()
          // A null query indicate to skip update
          if (!result) return
          else Object.assign(baseQuery, result)
        } else {
          Object.assign(baseQuery, options.baseQuery)
        }
      }
      // Last available data only for realtime visualization
      let query = baseQuery
      // Check if we have variables to be aggregate in time or not
      if (options.variables) {
        query = Object.assign({
          $limit: 1,
          $sort: { time: -1 },
          $groupBy: options.featureId,
          $aggregate: options.variables.map(variable => variable.name)
        }, baseQuery)
        // Request feature with at least one data available during last query interval
        const now = moment.utc()
        if (queryInterval) {
          query.time = {
            $gte: now.clone().subtract({ milliseconds: queryInterval }).format(),
            $lte: now.format()
          }
        } else {
          query.time = {
            $lte: now.format()
          }
        }
      }
      return await this.$api.getService(options.service).find({ query })
    }
  }
}

export default featureServiceMixin
