import moment from 'moment'

let featureServiceMixin = {
  methods: {
    async getProbeFeatures (options) {
      let response = await this.$api.getService(options.probeService).find({})
      return response
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
          $groupBy: options.featureId,
          $aggregate: options.variables.map(variable => variable.name)
        }, baseQuery)
        // Request feature with at least one data available during last query interval if none given
        const now = moment.utc()
        if (typeof queryInterval === 'object') {
          query.time = queryInterval
        } else if (Number.isInteger(queryInterval)) {
          Object.assign(query, {
            $limit: 1,
            $sort: { time: -1 },
            time: {
              $gte: now.clone().subtract({ milliseconds: queryInterval }).format(),
              $lte: now.format()
            }
          })
        } else {
          Object.assign(query, {
            $limit: 1,
            $sort: { time: -1 },
            time: { $lte: now.format() }
          })
        }
      }
      let response = await this.$api.getService(options.service).find({ query })
      return response
    }
  }
}

export default featureServiceMixin
