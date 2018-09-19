let servicesLayersMixin = {
  methods: {
    subscribeService (name, service, query, geojsonOptions) {
      this.unsubscribeService(name)
      const layerService = this.$api.getService(service)
      // Subscribe to the service
      this.serviceListeners[name] = layerService.watch({ listStrategy: 'always' })
      .find({ query })
      .subscribe(response => {
        let layer = this.getLayerByName(name)
        layer.clearLayers()
        // Declare the output GeoJson collection
        response.data.forEach(feature => {
          this.addGeoJsonToLayer(layer, feature, geojsonOptions)
        })
      })
    },
    unsubscribeService (name) {
      if (this.serviceListeners[name]) this.serviceListeners[name].unsubscribe()
      delete this.serviceListeners[name]
      let layer = this.getLayerByName(name)
      layer.clearLayers()
    },
    addServiceLayer (name, service, query, geojsonOptions, clusterOptions) {
      // Use a cluster by default ?
      this.addGeoJsonClusterLayer(name, clusterOptions)
      this.subscribeService(name, service, query, geojsonOptions)
    },
    removeServiceLayer (name) {
      this.unsubscribeService(name)
      this.removeGeoJsonLayer(name)
    }
  },
  created () {
    this.serviceListeners = {}
  }
}

export default servicesLayersMixin
