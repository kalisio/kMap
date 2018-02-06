import L from 'leaflet'

let collectionLayerMixin = {
  methods: {
    refreshLayer () {
      this.collectionLayer.clearLayers()
      this.items.forEach(item => this.addGeoJsonToLayer(this.collectionLayer, item))      
    },
    addCollectionLayer (name, clusterOptions, geojsonOptions) {
      this.geojsonOptions = geojsonOptions
      this.collectionLayer =  this.addGeoJsonClusterLayer(name, clusterOptions)
    },
    removeCollectionLayer (name) {
      this.removeGeoJsonLayer(name)
    }
  }
}

export default collectionLayerMixin
