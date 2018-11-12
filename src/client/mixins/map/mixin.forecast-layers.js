import L from 'leaflet'
import 'iso8601-js-period/iso8601.js'

let forecastLayersMixin = {
  data () {
    return {
      currentTime: null,
      forecastModel: null
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
        resolution: [decimationFactor * this.forecastModel.resolution[0], decimationFactor * this.forecastModel.resolution[1]],
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
    setupForecastLayers () {
      // Not yet ready
      if (!this.forecastModel || !this.map) return

      this.$config('map.forecastLayers').forEach(layerConfig => {
        let layer = this.getLayerByName(layerConfig.name)
        // Need to be created first
        if (!layer) {
          layer = new L.Weacast[layerConfig.type](this.weacastApi, layerConfig.options)
          this.addLayer(layerConfig.name, layer)
          this.forecastLayers.push(layer)
        }
        // For visualization we might decimate the data resolution for performance reasons
        layer.setForecastModel(this.getVisualModel(layerConfig))
      })
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.forecastLayers = []
  },
  mounted () {
  }
}

export default forecastLayersMixin
