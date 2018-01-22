import L from 'leaflet'

let servicesLayersMixin = {
  props: {
    services: {
      type: Array,
      required: true
    }
  },
  methods: {
    refreshLayers () {
      // Perform to all registered services
      const requests = this.services.map(layer => this.subscribeLayer(layer))
    },
    subscribeLayer (layer) {
      // Remove previous listener if any
      this.unsubscribeLayer(layer)
      let groupsService = this.$api.getService(layer.service)
      this.layerListeners[layer.name] = groupsService.find({
        rx: { listStrategy: 'always' }
      })
      .subscribe(response => {
        // Add the layer to the map
        this.addGeoJson(response.data, layer.name, layer.options)
      })
    },
    unsubscribeLayer (layer) {
      if (this.layerListeners[layer.name]) {
        this.layerListeners[layer.name].unsubscribe()
        delete this.layerListeners[layer.name]
        // Remove the layer from the map
        this.removeLayer(this.getLayerByName(layer.name))
      }
    }
  }  
}

export default servicesLayersMixin
