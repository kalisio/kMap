export default {
  methods: {
    createLeafletMapillary (options) {
      const leafletOptions = options.leaflet || options
      // Check for valid types
      if (leafletOptions.type !== 'vectorGrid.protobuf') return
      const layer = this.createLeafletLayer(options)
      if (leafletOptions.interactive) {
        layer.on('mouseover', (event) => {
          console.log(event)
          if (event.latlng) {
            let url = "https://images.mapillary.com/" + event.layer.properties.ikey  + "/thumb-320.jpg"
            console.log(event.latlng)
            L.popup()
              .setContent("<img src='" + url + "' width='300'/>")
              .setLatLng(event.latlng)
              .openOn(this.map)
          }
        })
      }
      return layer
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletMapillary)
  }
}
