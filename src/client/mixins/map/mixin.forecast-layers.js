import _ from 'lodash'
import L from 'leaflet'

import moment from 'moment'

let forecastLayersMixin = {
  data () {
    return {
      forecastModel: null,
      forecastModels: [],
      probedLocation: null
    }
  },
  methods: {
    getVisualModel (layerConfig) {
      // For visualization we might decimate the data resolution for performance reasons
      let decimationFactor = layerConfig.decimationFactor || 2
      // Copy forecast model
      let visualModel = Object.assign({}, this.forecastModel)
      // Then assign visual configuration
      Object.assign(visualModel, {
        name: this.forecastModel.name,
        origin: this.forecastModel.origin,
        bounds: this.forecastModel.bounds,
        size: [Math.floor(this.forecastModel.size[0] / decimationFactor), Math.floor(this.forecastModel.size[1] / decimationFactor)],
        resolution: [decimationFactor * this.forecastModel.resolution[0], decimationFactor * this.forecastModel.resolution[1]]
      })
      return visualModel
    },
    setupForecastModels () {
      return this.weacastApi.getService('forecasts').find()
      .then(response => {
        this.forecastModels = response.data
        // Select first one as current
        this.forecastModel = this.forecastModels.length > 0 ? this.forecastModels[0] : null
      })
    },
    createLeafletForecastLayer (options) {
      let leafletOptions = options.leaflet || options
      // Check for valid types
      if (!leafletOptions.type.startsWith('weacast')) return
      // Copy some generic options from model as well
      if (leafletOptions.arguments.length > 0) leafletOptions.arguments[0].attribution = this.forecastModel.attribution
      // We need to add Weacast API object as argument before creating the layer
      leafletOptions.arguments = [this.weacastApi].concat(leafletOptions.arguments)
      let layer = this.createLeafletLayer(options)
      // For visualization we might decimate the data resolution for performance reasons
      layer.setForecastModel(this.getVisualModel(leafletOptions))
      return layer
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

      let response = await this.weacastApi.getService('probes')
      .create({
        forecast: this.forecastModel.name,
        elements: this.forecastModel.elements.map(element => element.name)
      }, { query })
      if (response.features.length > 0) this.probedLocation = response.features[0]
    },
    async getForecastForFeature (featureId, startTime, endTime) {
      // Check if probe is available
      if (!this.probe) return

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
    },
    getValueAtCurrentTime (times, values) {
      // Check for the right value at time
      if (Array.isArray(times) && Array.isArray(values)) {
        // Look for the nearest time
        let timeIndex = 0
        let minDiff = Infinity
        times.forEach((time, index) => {
          let diff = Math.abs(this.currentTime.diff(moment.utc(time)))
          if (diff < minDiff) {
            minDiff = diff
            timeIndex = index
          }
        })
        // Check if we found a valid time within interval, otherwise the time is missing
        if ((minDiff / 1000) > (0.5 * this.forecastModel.interval)) return null
        else return values[timeIndex]
      } else {
        // Constant value
        return values
      }
    },
    getProbedLocationAtCurrentTime () {
      // Create new geojson from raw response containing all times
      let feature = _.cloneDeep(this.probedLocation)
      // Then check for the right value at time
      _.forOwn(feature.properties, (value, key) => {
        if (Array.isArray(value)) {
          feature.properties[key] = this.getValueAtCurrentTime(feature.forecastTime[key], value)
        }
      })
      return feature
    },
    getProbedLocationMarker (feature, latlng) {
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
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletForecastLayer)
  },
  mounted () {
  }
}

export default forecastLayersMixin
