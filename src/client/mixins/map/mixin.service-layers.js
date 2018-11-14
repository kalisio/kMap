let servicesLayersMixin = {
  methods: {
    subscribeService (name, service, query) {
      this.unsubscribeService(name)
      const layerService = this.$api.getService(service)
      // Subscribe to the service
      this.serviceListeners[name] = layerService.watch({ listStrategy: 'always' })
      .find({ query })
      .subscribe(response => {
        this.serviceLayer.clearLayers()
        // Declare the output GeoJson collection
        let features = this.createLeafletLayer({ type: 'geoJson', arguments: [ { type: 'FeatureCollection', features: response.data } ] })
        features.addTo(this.serviceLayer)
      })
    },
    unsubscribeService (name) {
      if (this.serviceListeners[name]) this.serviceListeners[name].unsubscribe()
      delete this.serviceListeners[name]
      let layer = this.getLeafletLayerByName(name)
      layer.clearLayers()
    },
    addServiceLayer (name, service, query, clusterOptions) {
      // Create an empty layer used as a container
      this.addLayer({
        name,
        type: 'OverlayLayer',
        leaflet: {
          type: 'geoJson',
          isVisible: true,
          arguments: [ { type: 'FeatureCollection', features: [] }, {
            cluster: clusterOptions
          }]
        }
      })
      this.serviceLayer = this.getLeafletLayerByName(name)
      this.subscribeService(name, service, query)
    },
    removeServiceLayer (name) {
      this.unsubscribeService(name)
      this.removeLayer(name)
    }
  },
  created () {
    this.serviceListeners = {}
  }
}

export default servicesLayersMixin
