import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// This ensure we have all required plugins
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js'

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
      // Add empty basic overlays control
      this.overlayLayersControl = L.control.layers({}, {})
      this.controls.push(this.overlayLayersControl)
      this.setupControls()
      this.checkOverlayLayersControlVisibility()
    },
    setupControls () {
      this.controls.forEach(control => control.addTo(this.map))
      this.$emit('controlsReady')
    },
    center (longitude, latitude, zoomLevel) {
      this.map.setView(new L.LatLng(latitude, longitude), zoomLevel || 12)
    },
    removeLayer (layer) {
      if (!layer) return

      this.overlayLayersControl.removeLayer(layer)
      // If it was visible remove it from map
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer)
      }
      this.checkOverlayLayersControlVisibility()
    },
    addLayer (layer, name) {
      if (layer && !this.map.hasLayer(layer)) {
        // Check if layer is visible by default
        let visible = true
        if (layer.options.hasOwnProperty('visible')) {
          visible = layer.options.visible
        }
        if (visible) {
          this.map.addLayer(layer)
        }
        this.overlayLayersControl.addOverlay(layer, name)
        this.checkOverlayLayersControlVisibility()
      }
      return layer
    },
    checkOverlayLayersControlVisibility () {
      // Hidden while nothing has been loaded, default state
      this.overlayLayersControl.getContainer().style.visibility = 'hidden'
      this.overlayLayersControl._layers.forEach(_ => {
        // We know there is at least one layer to display
        this.overlayLayersControl.getContainer().style.visibility = 'visible'
      })
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('map'))
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.controls = []
  },
  beforeDestroy () {
    this.map.remove()
  }
}

export default baseMapMixin
