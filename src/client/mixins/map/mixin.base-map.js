import _ from 'lodash'
import moment from 'moment'
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
    setupMap (options) {
      // Initialize the map
      this.map = L.map('map', Object.assign({ zoomControl: false }, options))
      this.$emit('map-ready')
    },
    processLeafletLayerOptions (options) {
      // Because we update objects in place and don't want leaflet internal objects to be reactive
      let processedOptions = _.cloneDeep(options)
      let leafletOptions = processedOptions.leaflet
      // Transform from string to actual objects when required in some of the layer options
      this.leafletObjectOptions.forEach(option => {
        // Find the right argument holding the option
        let options = _.find(leafletOptions.arguments, argument => typeof _.get(argument, option) === 'string')
        if (options) {
          // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
          _.set(options, option, _.get(L, _.get(options, option)))
        }
      })
      // Check for layer options object, create if required
      if (!_.has(leafletOptions, 'arguments[1]')) _.set(leafletOptions, 'arguments[1]', {})
      let layerOptions = _.get(leafletOptions, 'arguments[1]')
      layerOptions.attribution = processedOptions.attribution
      return processedOptions
    },
    createLeafletLayer (options) {
      return _.get(L, options.type)(...options.arguments)
    },
    registerLeafletConstructor (constructor) {
      this.leafletFactory.push(constructor)
    },
    async createLayer (options) {
      let processedOptions = this.processLeafletLayerOptions(options)
      let layer
      // Iterate over all registered constructors until we find one
      for (let i = 0; i < this.leafletFactory.length; i++) {
        const constructor = this.leafletFactory[i]
        layer = await constructor(processedOptions.leaflet)
        if (layer) break
      }
      // Use default Leaflet layer constructor if none found
      return (layer || this.createLeafletLayer(processedOptions.leaflet))
    },
    hasLayer (name) {
      return _.has(this.layers, name)
    },
    isLayerVisible (name) {
      let leafetLayer = this.getLeafletLayerByName(name)
      return leafetLayer && this.map.hasLayer(leafetLayer)
    },
    getLayerByName (name) {
      if (!this.hasLayer(name)) return null
      return this.layers[name]
    },
    getLeafletLayerByName (name) {
      if (!this.hasLayer(name)) return null
      return this.leafletLayers[name]
    },
    async showLayer (name) {
      // Retieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (this.isLayerVisible(name)) return
      layer.isVisible = true
      // Create the leaflet layer on first show
      let leafetLayer = this.getLeafletLayerByName(name)
      if (!leafetLayer) leafetLayer = await this.createLayer(layer)
      // Add the leaflet layer to the map
      this.leafletLayers[name] = leafetLayer
      this.map.addLayer(leafetLayer)
      // Ensure base layer will not pop on top of others
      if (layer.type === 'BaseLayer') leafetLayer.bringToBack()
    },
    hideLayer (name) {
      // retrieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (!this.isLayerVisible(name)) return
      layer.isVisible = false
      // Remove the leaflet layer from map
      let leafletLayer = this.leafletLayers[name]
      this.map.removeLayer(leafletLayer)
    },
    async addLayer (layer) {
      if (layer && !this.hasLayer(layer.name)) {
        layer.isVisible = false
        // Store the layer and make it reactive
        this.$set(this.layers, layer.name, layer)
        this.$emit('layer-added', layer)
        // Handle the visibility state
        if (_.get(layer, 'leaflet.isVisible', false)) await this.showLayer(layer.name)
      }
      return layer
    },
    removeLayer (name) {
      const layer = this.getLayerByName(name)
      if (!layer) return
      // If it was visible remove it from map
      if (layer.isVisible) this.hideLayer(name)
      // Delete the layer and make it reactive
      this.$delete(this.layers, layer.name)
      delete this.leafletLayers[name]
      this.$emit('layer-removed', layer)
    },
    center (longitude, latitude, zoomLevel) {
      this.map.setView(new L.LatLng(latitude, longitude), zoomLevel || 12)
    },
    setCurrentTime (datetime) {
      // String or milliseconds
      if (typeof datetime === 'string' || Number.isInteger(datetime)) {
        this.currentTime = moment.utc(datetime)
      } else {
        this.currentTime = datetime
      }
      this.$emit('current-time-changed', this.currentTime)
    },
    setMapCursor (className) {
      L.DomUtil.addClass(this.map._container, className)
    },
    unsetMapCursor (className) {
      L.DomUtil.removeClass(this.map._container, className)
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('map'))
  },
  created () {
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
