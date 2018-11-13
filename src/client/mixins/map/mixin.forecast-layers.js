import L from 'leaflet'
import 'iso8601-js-period/iso8601.js'

let forecastLayersMixin = {
  data () {
    return {
      currentTime: null,
      forecastModel: null,
      forecastModels: []
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
    createLeafletForecastLayer (options) {
      // Check for valid types
      if (!options.type.startsWith('weacast')) return
      // Copy some generic options from model as well
      if (options.arguments.length > 0) options.arguments[0].attribution = this.forecastModel.attribution
      // We need to add Weacast API object as argument before creating the layer
      options.arguments = [this.weacastApi].concat(options.arguments)
      let layer = this.createLeafletLayer(options)
      // For visualization we might decimate the data resolution for performance reasons
      layer.setForecastModel(this.getVisualModel(options))
      return layer
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletForecastLayer)
  },
  mounted () {
  }
}

export default forecastLayersMixin
