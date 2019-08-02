import _ from 'lodash'
import L from 'leaflet'
import logger from 'loglevel'
import moment from 'moment'
import { weacast } from 'weacast-core/client'
import { getNearestTime } from '../utils'

export default {
  data () {
    return {
      forecastModel: null,
      forecastModels: [],
      forecastLevel: 0,
      forecastLevels: {}
    }
  },
  computed: {
    hasForecastLevels () {
      return _.get(this.forecastLevels, 'values', []).length > 0
    }
  },
  methods: {
    async setupWeacast (config) {
      // If no client config given we assume to proxy the Weacast API internally
      if (config) {
        const catalogService = this.$api.getService('catalog')
        // Check for existing service in catalog overriding default config
        let response = await catalogService.find({ query: { type: 'service', name: 'weacast' } })
        if (response.data.length > 0) config.apiUrl = response.data[0].endpoint
        this.weacastApi = weacast(config)
        // Ensure we also logout from weacast on app logout
        this.$api.on('logout', () => this.weacastApi.logout())
        try {
          // Transfer app token to Weacast
          const accessToken = await this.$api.passport.getJWT()
          const weacastAccessToken = await this.weacastApi.passport.getJWT()
          if (weacastAccessToken) await this.weacastApi.authenticate()
          else await this.weacastApi.authenticate({ strategy: 'jwt', accessToken })
        } catch (error) {
          logger.error('Cannot initialize Weacast API', error)
        }
      } else {
        this.weacastApi = this.$api
        // We need to implement time management however
        this.weacastApi.setForecastTime = (time) => {
          this.$api.forecastTime = time
          this.$api.emit('forecast-time-changed', time)
        }
        this.weacastApi.getForecastTime = () => {
          return this.$api.forecastTime
        }
      }
      try {
        await this.setupForecastModels()
      } catch (error) {
        logger.error('Cannot retrieve available Weacast forecast models', error)
      }
    },
    async setupForecastModels () {
      if (!this.weacastApi) return
      const response = await this.weacastApi.getService('forecasts').find()
      this.forecastModels = response.data
      // Select default if any or first one
      this.forecastModel = this.forecastModels.find(forecast => forecast.isDefault)
      if (!this.forecastModel) {
        this.forecastModel = (this.forecastModels.length > 0 ? this.forecastModels[0] : null)
      }
    },
    setForecastModel (model) {
      this.forecastModel = model
      this.$emit('forecast-model-changed', this.forecastModel)
    },
    setForecastLevel (level) {
      this.forecastLevel = level
      this.$emit('forecast-level-changed', this.forecastLevel)
    },
    getFormatedForecastLevel(level) {
      const unit = _.get(this.forecastLevels, 'units[0]')
      return `${level ? level : this.forecastLevel} ${unit}`
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
        let elements = this.forecastModel.elements.map(element => element.name)
        // Filter available elements according to current level if any
        if (this.forecastLevel) elements = elements.filter(element => element.endsWith(this.forecastLevel.toString()))
        let response = await this.weacastApi.getService('probes')
        .create({
          forecast: this.forecastModel.name,
          elements
        }, { query })
        if (response.features.length > 0) {
          this.probedLocation = response.features[0]
          this.$emit('probed-location-changed', this.probedLocation)
        } else throw new Error('Cannot find valid forecast at location')
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
        let elements = this.forecastModel.elements.map(element => element.name)
        // Filter available elements according to current level if any
        if (this.forecastLevel) {
          elements = elements.filter(element => element.endsWith(this.forecastLevel.toString()))
        }
        // Need to add derived values for static probes as they are not computed on the fly
        const windDirection = (this.forecastLevel ? `windDirection-${this.forecastLevel}` : 'windDirection')
        const windSpeed = (this.forecastLevel ? `windSpeed-${this.forecastLevel}` : 'windSpeed')
        elements = elements.concat([windDirection, windSpeed])
        
        let results = await this.weacastApi.getService('probe-results').find({
          query: {
            probeId: this.probe._id,
            forecastTime: {
              $gte: startTime.format(),
              $lte: endTime.format()
            },
            [this.probe.featureId]: featureId,
            $groupBy: this.probe.featureId,
            $aggregate: elements
          }
        })
        if (results.length > 0) {
          this.probedLocation = results[0]
          this.$emit('probed-location-changed', this.probedLocation)
        } else throw new Error('Cannot find valid forecast for feature')
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
      if (!properties) return null
      const windDirection = (this.forecastLevel ? `windDirection-${this.forecastLevel}` : 'windDirection')
      const windSpeed = (this.forecastLevel ? `windSpeed-${this.forecastLevel}` : 'windSpeed')
      const temperature = (this.forecastLevel ? `temperature-${this.forecastLevel}` : 'temperature')
      if (!_.has(properties, windDirection) || !_.has(properties, windSpeed)) return null
      // Use wind barbs on probed features
      let icon = new L.WindBarb.Icon({
        deg: _.get(properties, windDirection),
        speed: _.get(properties, windSpeed) / 0.514, // Expressed as knots
        pointRadius: 10,
        pointColor: '#2B85C7', // TODO: colorize according to temperature scale if
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
    },
    onWeacastShowLayer (layer, engineLayer) {
      // Check for valid types
      const levels = _.get(layer, 'levels')
      if (!levels) return
      this.forecastLevels = levels
      this.forecastLevelsLayer = layer
    },
    onWeacastHideLayer (layer) {
      if (this.forecastLevelsLayer && (this.forecastLevelsLayer._id === layer._id)) {
        this.forecastLevels = []
      }
    }
  },
  created () {
    this.$on('current-time-changed', this.onCurrentForecastTimeChanged)
    this.$on('layer-shown', this.onWeacastShowLayer)
    this.$on('layer-hidden', this.onWeacastHideLayer)
  },
  mounted () {
  },
  beforeDestroy () {
    this.$off('current-time-changed', this.onCurrentForecastTimeChanged)
    this.$off('layer-shown', this.onWeacastShowLayer)
    this.$off('layer-hidden', this.onWeacastHideLayer)
  }
}
