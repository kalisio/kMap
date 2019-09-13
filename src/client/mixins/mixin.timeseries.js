import _ from 'lodash'
import moment from 'moment'

export default {
  data () {
    return {
      probedLocation: null
    }
  },
  computed: {
    probedLocationName () {
      if (!this.probedLocation) return ''
      let name = _.get(this.probedLocation, 'properties.name') || _.get(this.probedLocation, 'properties.NAME')
      if (!name && _.has(this.probedLocation, 'geometry.coordinates')) {
        const longitude = _.get(this.probedLocation, 'geometry.coordinates[0]')
        const latitude = _.get(this.probedLocation, 'geometry.coordinates[1]')
        name = this.$t('mixins.timeseries.PROBE') + ` (${longitude.toFixed(2)}°, ${latitude.toFixed(2)}°)`
      }
      return name || ''
    }
  },
  methods: {
    async updateProbedLocationLayer () {
      if (!this.probedLocation) return
      const name = this.$t('mixins.timeseries.PROBED_LOCATION')
      const windDirection = (this.forecastLevel ? `windDirection-${this.forecastLevel}` : 'windDirection')
      const windSpeed = (this.forecastLevel ? `windSpeed-${this.forecastLevel}` : 'windSpeed')
      // Use wind barbs on weather probed features
      const isWeatherProbe = (_.has(this.probedLocation, `properties.${windDirection}`) &&
                              _.has(this.probedLocation, `properties.${windSpeed}`))
      // Get any previous layer or create it the first time
      const layer = this.getLayerByName(name)
      if (!layer) {
        await this.addLayer({
          name,
          type: 'OverlayLayer',
          icon: 'colorize',
          isStorable: false,
          isEditable: false,
          leaflet: {
            type: 'geoJson',
            isVisible: true,
            realtime: true,
            popup: { pick: [] }
          },
          cesium: {
            type: 'geoJson',
            isVisible: true,
            realtime: true,
            popup: { pick: [] }
          }
        })
      }
      // Update data
      this.updateLayer(name, isWeatherProbe
        ? this.getProbedLocationForecastAtCurrentTime()
        : this.getProbedLocationMeasureAtCurrentTime())
    },
    resizeTimeseries (width, height) {
      this.$refs.timeseries.resizeGraph(width, height)
    },
    async onShowProbedLocationLayer (layer) {
      // Show timeseries on probed location
      const name = this.$t('mixins.timeseries.PROBED_LOCATION')
      if ((layer.name === name) && !this.isTimeseriesOpen()) {
        this.openTimeseries()
        this.center(...this.probedLocation.geometry.coordinates)
      }
    },
    onHideProbedLocationLayer (layer) {
      // Hide timeseries on probed location
      if (layer.name === this.$t('mixins.timeseries.PROBED_LOCATION')) {
        if (this.isTimeseriesOpen()) this.closeTimeseries()
      }
    },
    onProbeLocation () {
      const probe = async (options, event) => {
        this.unsetCursor('probe-cursor')
        const { start, end } = this.getTimeRange()
        await this.getForecastForLocation(event.latlng.lng, event.latlng.lat, start, end)
        this.openTimeseries()
      }
      this.setCursor('probe-cursor')
      this.$once('click', probe)
    },
    async onProbeFeatureClicked (options, event) {
      let feature = _.get(event, 'target.feature')
      const entity = event.target
      if (!feature && !entity) return
      // For Cesium we have a different setup
      if (this.engine === 'cesium') {
        if (!entity.properties) return
        feature = { properties: entity.properties.getValue(0) }
      }
      const windDirection = (this.forecastLevel ? `windDirection-${this.forecastLevel}` : 'windDirection')
      const windSpeed = (this.forecastLevel ? `windSpeed-${this.forecastLevel}` : 'windSpeed')
      const isWeatherProbe = (_.has(feature, `properties.${windDirection}`) &&
                              _.has(feature, `properties.${windSpeed}`) &&
                              (options.name === this.$t('mixins.timeseries.PROBED_LOCATION')))
      let hasTimeseries = true
      // Update timeseries data if required
      const { start, end } = this.getTimeRange()
      if (options.probe) { // Static weacast probe
        const probe = await this.getForecastProbe(options.probe)
        if (probe) {
          await this.getForecastForFeature(_.get(feature, this.probe.featureId), start, end)
        }
      } else if (options.variables && options.service) { // Static measure probe
        await this.getMeasureForFeature(options, feature,
          this.currentTime.clone().subtract({ seconds: options.history }), this.currentTime.clone())
      } else if (isWeatherProbe) { // Dynamic weacast probe
        this.getForecastForLocation(event.latlng.lng, event.latlng.lat, start, end)
      } else {
        hasTimeseries = false
      }
      if (hasTimeseries) this.openTimeseries()
    },
    async updateProbedLocationForecast (model) {
      // Update probed location if any
      if (this.probedLocation) {
        const { start, end } = this.getTimeRange()
        // Feature mode
        if (this.probe && this.probedLocation.probeId) {
          const probe = await this.getForecastProbe(this.probe.name)
          if (probe) {
            await this.getForecastForFeature(_.get(this.probedLocation, this.probe.featureId), start, end)
          }
        } else { // Location mode
          await this.getForecastForLocation(this.probedLocation.geometry.coordinates[0],
                                            this.probedLocation.geometry.coordinates[1], start, end)
        }
      }
    },
    isTimeseriesOpen () {
      return (this.$refs.timeseriesWidget && this.$refs.timeseriesWidget.isOpen())
    },
    openTimeseries () {
      this.showLayer(this.$t('mixins.timeseries.PROBED_LOCATION'))
      if (this.isTimeseriesOpen()) return
      this.$refs.timeseriesWidget.open()
    },
    closeTimeseries () {
      this.hideLayer(this.$t('mixins.timeseries.PROBED_LOCATION'))
      if (!this.isTimeseriesOpen()) return
      this.$refs.timeseriesWidget.close()
    },
    toggleTimeseries () {
      this.$refs.timeseriesWidget.toggle()
      if (this.isLayerVisible(this.$t('mixins.timeseries.PROBED_LOCATION'))) this.hideLayer(this.$t('mixins.timeseries.PROBED_LOCATION'))
      else this.showLayer(this.$t('mixins.timeseries.PROBED_LOCATION'))
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-location-time-series'] = this.$load('KLocationTimeSeries')
    this.$options.components['k-widget'] = this.$load('frame/KWidget')
  },
  mounted () {
    this.$on('layer-shown', this.onShowProbedLocationLayer)
    this.$on('layer-hidden', this.onHideProbedLocationLayer)
    this.$on('probed-location-changed', this.updateProbedLocationLayer)
    this.$on('current-time-changed', this.updateProbedLocationLayer)
    this.$on('forecast-model-changed', this.updateProbedLocationForecast)
    this.$on('forecast-level-changed', this.updateProbedLocationForecast)
    this.$on('click', this.onProbeFeatureClicked)
  },
  beforeDestroy () {
    this.$off('layer-shown', this.onShowProbedLocationLayer)
    this.$off('layer-hidden', this.onHideProbedLocationLayer)
    this.$off('probed-location-changed', this.updateProbedLocationLayer)
    this.$off('current-time-changed', this.updateProbedLocationLayer)
    this.$off('forecast-model-changed', this.updateProbedLocationForecast)
    this.$off('forecast-level-changed', this.updateProbedLocationForecast)
    this.$off('click', this.onProbeFeatureClicked)
  }
}
