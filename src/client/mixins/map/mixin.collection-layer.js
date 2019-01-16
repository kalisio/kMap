import _ from 'lodash'

let collectionLayerMixin = {
  methods: {
    refreshLayer () {
      this.collectionLayer.clearLayers()
      let filteredItems = _.filter(this.items, (item) => this.filterItem(item))
      let layer = this.createLeafletLayer({ type: 'geoJson', source: { type: 'FeatureCollection', features: filteredItems } })
      layer.addTo(this.collectionLayer)
    },
    async addCollectionLayer (name, clusterOptions) {
      // Create an empty layer used as a container
      await this.addLayer({
        name,
        type: 'OverlayLayer',
        leaflet: {
          type: 'geoJson',
          isVisible: true,
          cluster: clusterOptions
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
