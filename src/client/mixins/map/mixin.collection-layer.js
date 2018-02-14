import _ from 'lodash'

let collectionLayerMixin = {
  methods: {
    refreshLayer () {
      this.collectionLayer.clearLayers()
      let filteredItems = _.filter(this.items, (item) => this.filterItem(item))
      filteredItems.forEach(item => this.addGeoJsonToLayer(this.collectionLayer, item))
    },
    addCollectionLayer (name, clusterOptions, geojsonOptions) {
      this.geojsonOptions = geojsonOptions
      this.collectionLayer = this.addGeoJsonClusterLayer(name, clusterOptions)
    },
    removeCollectionLayer (name) {
      this.removeGeoJsonLayer(name)
    }
  }
}

export default collectionLayerMixin
