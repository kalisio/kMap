import _ from 'lodash'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// This ensure we have all required plugins
import 'leaflet-fa-markers/L.Icon.FontAwesome.css'
import 'leaflet-fa-markers/L.Icon.FontAwesome.js'
import 'leaflet-realtime'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import 'leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js'

import { LeafletEvents, bindLeafletEvents, unbindLeafletEvents } from '../../utils'

// Fix to make Leaflet assets be correctly inserted by webpack
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
})

let baseMapMixin = {
  methods: {
    refreshMap () {
      this.map.invalidateSize()
    },
    setupMap () {
      // Initialize the map
      this.map = L.map('map').setView([46, 1.5], 5)
      this.setupControls()
    },
    setupControls () {
      this.controls.forEach(control => control.addTo(this.map))
      this.$emit('controlsReady')
    },
    createLayer (layerConfiguration) {
      // Transform from string to actual objects when required in some of the layer options
      ['crs', 'rendererFactory'].forEach(option => {
        // Find the right argument holding the option
        let options = _.find(layerConfiguration.arguments, argument => typeof _.get(argument, option) === 'string')
        if (options) {
          // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
          _.set(options, option, _.get(L, _.get(options, option)))
        }
      })
      let type = layerConfiguration.type
      if ((type === 'realtime') && (layerConfiguration.arguments.length > 1)) {
        let options = layerConfiguration.arguments[1]
        const id = _.get(options, 'id')
        if (id) _.set(options, 'getFeatureId', (feature) => _.get(feature, id))
        if (this.getGeoJsonOptions && options) _.assign(options, this.getGeoJsonOptions())
      }
      let layer = _.get(L, type)(...layerConfiguration.arguments)
      return layer
    },
    center (longitude, latitude, zoomLevel) {
      this.map.setView(new L.LatLng(latitude, longitude), zoomLevel || 12)
    },
    hasLayer (name) {
      return _.has(this.layers, name)
    },
    getLayerByName (name) {
      if (!this.hasLayer(name)) return null
      return this.layers[name]
    },
    addLayer (name, layer) {
      if (layer && !this.map.hasLayer(layer)) {
        // Store the layer
        this.layers[name] = layer
        bindLeafletEvents(layer, LeafletEvents.Layer, this)
        // Check if layer is visible by default
        let visible = true
        if (layer.options.hasOwnProperty('visible')) {
          visible = layer.options.visible
        }
        if (visible) {
          this.map.addLayer(layer)
        }
      }
      return layer
    },
    removeLayer (name) {
      const layer = this.getLayerByName(name)
      if (!layer) return
      unbindLeafletEvents(layer)
      // If it was visible remove it from map
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer)
      }
      // Remove the layer
      delete this.layers[name]
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('map'))
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.controls = []
    this.layers = {}
  },
  beforeDestroy () {
    this.map.remove()
  }
}

export default baseMapMixin
