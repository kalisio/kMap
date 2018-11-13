import _ from 'lodash'
import moment, { relativeTimeRounding } from 'moment'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// This ensure we have all required plugins
import 'leaflet-fa-markers/L.Icon.FontAwesome.css'
import 'leaflet-fa-markers/L.Icon.FontAwesome.js'
import 'leaflet-realtime'
import 'leaflet-fullscreen'
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
  data () {
    return {
      layers: {}
    }
  },  
  methods: {
    refreshMap () {
      this.map.invalidateSize()
    },
    setupMap () {
      // Initialize the map
      this.map = L.map('map', { zoomControl: false }).setView([46, 1.5], 5)
      this.$emit('map-ready')
    },
    processLeafletLayerOptions (options) {
      // Because we update objects in place
      let processedOptions = _.cloneDeep(options)
      // Transform from string to actual objects when required in some of the layer options
      this.leafletObjectOptions.forEach(option => {
        // Find the right argument holding the option
        let options = _.find(processedOptions.arguments, argument => typeof _.get(argument, option) === 'string')
        if (options) {
          // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
          _.set(options, option, _.get(L, _.get(options, option)))
        }
      })
      return processedOptions
    },
    createLeafletLayer (options) {
      return _.get(L, options.type)(...options.arguments)
    },
    registerLeafletConstructor (constructor) {
      this.leafletFactory.push(constructor)
    },
    createLayer (options) {
      let processedOptions = this.processLeafletLayerOptions(options)
      let layer
      // Iterate over all registered constructors until we find one
      for (let i = 0; i < this.leafletFactory.length; i++) {
        const constructor = this.leafletFactory[i]
        layer = constructor(processedOptions)
        if (layer) break
      }
      // Use default Leaflet layer constructor if none found
      return (layer ? layer : this.createLeafletLayer(options))
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
    showLayer (name) {
      // Retieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (layer.isVisible === true) return
      layer.isVisible = true
      // Create the leaflet layer
      let leafetLayer = this.createLayer(layer.leaflet)
      this.leafletLayers[name] = leafetLayer
      this.map.addLayer(leafetLayer)
    },
    hideLayer (name) {
      // retrieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (layer.isVisible === false) return
      layer.isVisible = false
      // Delete the leaflet layer
      let leafletLayer = this.leafletLayers[name]
      this.map.removeLayer(leafletLayer)
      delete this.leafletLayers[name]
    },
    addLayer (layer) {
      if (layer && !this.hasLayer(layer.name)) {
        // Store the layer
        this.layers[layer.name] = layer
        // Handle the visibility state
        layer['isVisible'] = false
        if (_.get(layer, 'leaflet.arguments[1].isVisible', false)) this.showLayer(layer.name)
      }
      return layer
    },
    removeLayer (name) {
      const layer = this.getLayerByName(name)
      if (!layer) return
      // If it was visible remove it from map
      if (layer.isVisible === false) this.hideLayer(name)
      // Delete the layer
      delete this.layers[name]
    },
    setCurrentTime (datetime) {
      // String or milliseconds
      if (typeof datetime === 'string' || Number.isInteger(datetime)) {
        this.currentTime = moment.utc(datetime)
      } else {
        this.currentTime = datetime
      }
      this.$emit('current-time-changed', this.currentTime)
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('map'))
  },
  created () {
    this.baseLayer = null
    this.leafletLayers = {}
    this.leafletFactory = []
    // Default Leaflet layer options requiring conversion from string to actual Leaflet objects
    this.leafletObjectOptions = ['crs', 'rendererFactory']
  },
  beforeDestroy () {
    Object.keys(this.layers).forEach((layer) => this.removeLayer(layer))
    this.map.remove()
  }
}

export default baseMapMixin
