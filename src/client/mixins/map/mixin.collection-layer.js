import _ from 'lodash'

let collectionLayerMixin = {
  methods: {
    refreshLayer () {
      this.collectionLayer.clearLayers()
      let filteredItems = _.filter(this.items, (item) => this.filterItem(item))
      let layer = this.createLeafletLayer({ type: 'geoJson', arguments: [ { type: 'FeatureCollection', features: filteredItems } ] })
      layer.addTo(this.collectionLayer)
    },
    addCollectionLayer (name, clusterOptions) {
      // Create an empty layer used as a container
      this.addLayer({
        name,
        type: 'OverlayLayer',
        leaflet: {
          type: 'geoJson',
          isVisible: true,
          arguments: [ {}, {
            cluster: clusterOptions
          }]
        }
      })
      this.collectionLayer = this.getLeafletLayerByName(name)
    },
    removeCollectionLayer (name) {
      this.removeLayer(name)
    }
  }
}

export default collectionLayerMixin
