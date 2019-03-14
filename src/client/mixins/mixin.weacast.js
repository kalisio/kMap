import _ from 'lodash'
import L from 'leaflet'
import logger from 'loglevel'
import moment from 'moment'
import { weacast } from 'weacast-core/client'
import { getNearestTime } from '../utils'

let weacastMixin = {
  data () {
    return {
      forecastModel: null,
      forecastModels: [],
      probedLocation: null
    }
  },
  methods: {
    async setupWeacast (config) {
      const catalogService = this.$api.getService('catalog')
      // Check for existing service in catalog overriding default config
      let response = await catalogService.find({ query: { type: 'service', name: 'weacast' } })
      if (response.data.length > 0) config.apiUrl = response.data[0].endpoint
      this.weacastApi = weacast(config)
      // Setup hooks if any
      if (config.hooks) this.weacastApi.hooks(config.hooks)
      // Ensure we also logout from weacast on app logout
      this.$api.on('logout', () => this.weacastApi.logout())
      try {
        // Transfer app token to Weacast
        const accessToken = await this.$api.passport.getJWT()
        const weacastAccessToken = await this.weacastApi.passport.getJWT()
        if (weacastAccessToken) await this.weacastApi.authenticate()
        else await this.weacastApi.authenticate({ strategy: 'jwt', accessToken })
        this.setupForecastModels()
      } catch (error) {
        logger.error('Cannot initialize weacast API', error)
      }
    },
    setupForecastModels () {
      return this.weacastApi.getService('forecasts').find()
      .then(response => {
        this.forecastModels = response.data
        // Select first one as current
        this.forecastModel = this.forecastModels.length > 0 ? this.forecastModels[0] : null
      })
    },
    async getForecastForLocation (long, lat, startTime, endTime) {
      // Not yet ready
      if (!this.forecastModel) return
      // From now to last available time
      const geometry = {
        type: 'Point',
        coordinates: [ long, lat ]
      }
      const query = {
        forecastTime: {
          $gte: startTime.format(),
          $lte: endTime.format()
        },
        geometry: {
          $geoIntersects: {
            $geometry: geometry
          }
        }
      }

      this.setCursor('processing-cursor')
      try {
        let response = await this.weacastApi.getService('probes')
        .create({
          forecast: this.forecastModel.name,
          elements: this.forecastModel.elements.map(element => element.name)
        }, { query })
        if (response.features.length > 0) this.probedLocation = response.features[0]
        else throw new Error('Cannot find valid forecast at location')
        this.createProbedLocationLayer()
      } catch (error) {
        this.probedLocation = null
        logger.error(error)
      }
      this.unsetCursor('processing-cursor')
    },
    async getForecastProbe (name) {
      // Not yet ready
      if (!this.forecastModel) return
      // Avoid reloading probe when not necessary
      if (this.probe && (this.probe.name === name) && (this.probe.forecast === this.forecastModel.name)) {
        return this.probe
      }
      const results = await this.weacastApi.getService('probes').find({
        query: {
          name,
          forecast: this.forecastModel.name,
          $paginate: false,
          $select: ['elements', 'forecast', 'featureId']
        }
      })
      if (results.length > 0) {
        this.probe = results[0]
        return this.probe
      } else {
        return null
      }
    },
    async getForecastForFeature (featureId, startTime, endTime) {
      // Not yet ready
      if (!this.forecastModel) return
      // Check if probe is available
      if (!this.probe) return

      this.setCursor('processing-cursor')
      try {
        let results = await this.weacastApi.getService('probe-results').find({
          query: {
            probeId: this.probe._id,
            forecastTime: {
              $gte: startTime.format(),
              $lte: endTime.format()
            },
            [this.probe.featureId]: featureId,
            $groupBy: this.probe.featureId,
            $aggregate: this.forecastModel.elements.map(element => element.name).concat(['windDirection', 'windSpeed'])
          }
        })
        if (results.length > 0) this.probedLocation = results[0]
        else throw new Error('Cannot find valid forecast for feature')
        this.createProbedLocationLayer()
      } catch (error) {
        this.probedLocation = null
        logger.error(error)
      }
      this.unsetCursor('processing-cursor')
    },
    getForecastValueAtCurrentTime (times, values) {
      // Check for the right value at time
      if (Array.isArray(times) && Array.isArray(values)) {
        // Look for the nearest time
        const nearestTime = getNearestTime(this.currentTime, times.map(time => moment.utc(time)))
        // Check if we found a valid time within interval, otherwise the time is missing
        if ((nearestTime.difference / 1000) > (0.5 * this.forecastModel.interval)) return null
        else return values[nearestTime.index]
      } else {
        // Constant value
        return values
      }
    },
    getProbedLocationForecastAtCurrentTime () {
      // Create new geojson from raw response containing all times
      let feature = _.cloneDeep(this.probedLocation)
      // Then check for the right value at time
      _.forOwn(feature.properties, (value, key) => {
        if (Array.isArray(value)) {
          const times = _.get(feature, 'forecastTime.' + key)
          if (times) {
            feature.properties[key] = this.getForecastValueAtCurrentTime(times, value)
          }
        }
      })
      return feature
    },
    getProbedLocationForecastMarker (feature, latlng) {
      const properties = feature.properties
      if (!properties || !properties.windDirection || !properties.windSpeed) return null
      // Use wind barbs on probed features
      let icon = new L.WindBarb.Icon({
        deg: properties.windDirection,
        speed: properties.windSpeed / 0.514, // Expressed as knots
        pointRadius: 10,
        pointColor: '#2B85C7',
        pointStroke: '#111',
        strokeWidth: 2,
        strokeColor: '#000',
        strokeLength: 12,
        barbSpaceing: 4,
        barbHeight: 10,
        forceDir: true
      })
      return L.marker(latlng, { icon, draggable: 'true' })
    },
    onCurrentForecastTimeChanged (time) {
      this.weacastApi.setForecastTime(time)
    }
  },
  created () {
    this.$on('current-time-changed', this.onCurrentForecastTimeChanged)
  },
  mounted () {
  },
  beforeDestroy () {
    this.$off('current-time-changed', this.onCurrentForecastTimeChanged)
  }
}

export default weacastMixin
