import L from 'leaflet'
import moment from 'moment'
import 'iso8601-js-period/iso8601.js'

let forecastLayersMixin = {
  data () {
    return {
      currentTime: null
    }
  },
  methods: {
    async setupForecastModels () {
      const response = await this.weacastApi.service('forecasts').find()
      response.data.forEach(forecast => {
        forecast.elements.forEach(element => {
          // Declare element service
          let elementService = this.weacastApi.service(forecast.name + '/' + element.name)
          // These services do some computations that might be long
          elementService.timeout = 30000
        })
      })
      // Select first one
      this.forecastModel = response.data.length > 0 ? response.data[0] : null
    },
    setupForecastLayers () {
      // Not yet ready
      if (!this.forecastModel || !this.map || !this.map.timeDimension) return
      
      this.$config('map.forecastLayers').forEach(layerConfig => {
        let layer = new L.Weacast[layerConfig.type](this.weacastApi, layerConfig.options)
        this.addLayer(layerConfig.name, layer)
        // For visualization we might decimate the data resolution for performance reasons
        let decimationFactor = layerConfig.decimationFactor || 2
        let visualModel = {
          name: this.forecastModel.name,
          origin: this.forecastModel.origin,
          bounds: this.forecastModel.bounds,
          size: [Math.floor(this.forecastModel.size[0] / decimationFactor), Math.floor(this.forecastModel.size[1] / decimationFactor)],
          resolution: [decimationFactor * this.forecastModel.resolution[0], decimationFactor * this.forecastModel.resolution[1]]
        }
        // Should come last so that we do not trigger multiple updates of data
        layer.setForecastModel(visualModel)
        this.forecastLayers.push(layer)
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
