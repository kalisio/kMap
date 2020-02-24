import HeatmapOverlay from 'leaflet-heatmap'

export default {
  methods: {
    createLeafletHeatmapLayer (options) {
      const leafletOptions = options.leaflet || options
      // Check for valid types
      if (leafletOptions.type !== 'Heatmap') return
      const layer = this.createLeafletLayer(options)
      return layer
    },
    updateHeatmap (name, geoJsonOrConfig) {
      // Retrieve the layer
      let layer = this.getLeafletLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      // If no features we assume a config object
      if (!geoJsonOrConfig.features) {
        layer._heatmap.configure(geoJsonOrConfig)
      } else {
        // Otherwise we update data
        const valueField = _.get(layer, 'options.valueField')
        const values = (valueField ? geoJsonOrConfig.features.map(feature => _.get(feature, valueField)): [])
        // By default our intensity is based on the number of points only
        // otherwise when provided we use target value
        layer.setData({
          min: (valueField ? _.min(values) : 0),
          max: (valueField ? _.max(values) : 1),
          data: geoJsonOrConfig.features.map(feature => ({
            lng: _.get(feature, 'geometry.coordinates[0]'),
            lat: _.get(feature, 'geometry.coordinates[1]'),
            value: (valueField ? _.get(feature, valueField) : 1)
          }))
        })
      }
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletHeatmapLayer)
  }
}

// Not automatically declared by leaflet plugin
L.heatmap = function (options) {
  return new HeatmapOverlay(options)
}
