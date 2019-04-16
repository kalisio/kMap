import _ from 'lodash'
import 'weacast-leaflet'

let forecastLayersMixin = {
  methods: {
    getVisualForecastModel (layerConfig) {
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
    createLeafletForecastLayer (options) {
      let leafletOptions = options.leaflet || options
      // Check for valid types
      if (!leafletOptions.type.startsWith('weacast')) return
      // We need to add Weacast API object as argument before creating the layer
      leafletOptions.source = this.weacastApi
      // Copy as well color map options
      const colorMap = _.get(options, 'variables[0].chromajs')
      if (colorMap) Object.assign(leafletOptions, colorMap)
      let layer = this.createLeafletLayer(options)
      // For visualization we might decimate the data resolution for performance reasons
      layer.setForecastModel(this.getVisualForecastModel(leafletOptions))
      return layer
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletForecastLayer)
  }
}

export default forecastLayersMixin
