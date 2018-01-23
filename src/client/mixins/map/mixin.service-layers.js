import _ from 'lodash'
import L from 'leaflet'

let servicesLayersMixin = {
  methods: {
    addServiceLayer (name, service, query, geojsonOptions) {
      // Remove previous if any
      const layerService = this.$api.getService(service)
      // Subscribe to the service
      this.serviceListeners[name] = layerService.find({
        rx: { listStrategy: 'always' },
        query: query
      })
      .subscribe(response => {
        // Add the layer to the map
        console.log(response)
         // Declare the output GeoJson collection
        let collection = {
          type: 'FeatureCollection',
          features: response.data
        }
        this.addGeoJsonLayer(name, collection, geojsonOptions)
      })
    },
    removeServiceLayer (name) {
      if (this.serviceListeners[name]) {
        this.serviceListeners[name].unsubscribe()
        delete this.serviceListeners[name]
        // Remove the layer from the map
       this.removeGeoJsonLayer(name)
      }
    }
  },
  created () {
    this.serviceListeners = {}
  }
}

export default servicesLayersMixin
