import _ from 'lodash'
import logger from 'loglevel'
import moment from 'moment'
import { getNearestTime } from '../utils'

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
    },
    getMeasureValueAtCurrentTime (times, values) {
      // Check for the right value at time
      if (Array.isArray(times) && Array.isArray(values)) {
        /// Look for the nearest time
        const nearestTime = getNearestTime(this.currentTime, times.map(time => moment.utc(time)))
        return (nearestTime.index > 0 ? values[nearestTime.index] : null)
      } else {
        // Constant value
        return values
      }
    },
    getProbedLocationMeasureAtCurrentTime () {
      // Create new geojson from raw response containing all times
      let feature = _.cloneDeep(this.probedLocation)
      // Then check for the right value at time
      _.forOwn(feature.properties, (value, key) => {
        if (Array.isArray(value)) {
          const times = _.get(feature, 'time.' + key)
          if (times) {
            feature.properties[key] = this.getMeasureValueAtCurrentTime(times, value)
          }
        }
      })
      return feature
    },
    async getMeasureForFeature (layer, feature, startTime, endTime) {
      this.setCursor('processing-cursor')
      try {
        let result = await this.getFeatures(Object.assign({
          baseQuery: { ['properties.' + layer.featureId]: _.get(feature, 'properties.' + layer.featureId) }
        }, layer), {
          $gte: startTime.format(),
          $lte: endTime.format()
        })
        if (result.features.length > 0) this.probedLocation = result.features[0]
        else throw new Error('Cannot find valid measure for feature')
        this.createProbedLocationLayer()
      } catch (error) {
        this.probedLocation = null
        logger.error(error)
      }
      this.unsetCursor('processing-cursor')
    }
  }
}

export default featureServiceMixin
