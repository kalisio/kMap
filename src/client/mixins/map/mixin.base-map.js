import _ from 'lodash'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// This ensure we have all required plugins
import 'leaflet-fa-markers/L.Icon.FontAwesome.css'
import 'leaflet-fa-markers/L.Icon.FontAwesome.js'
import 'leaflet-fullscreen'
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import 'leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js'
import 'Leaflet.Geodesic'
import { LeafletEvents, bindLeafletEvents } from '../../utils'

// Fix to make Leaflet assets be correctly inserted by webpack
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
})

export default {
  data () {
    return {
      layers: {}
    }
  },
  methods: {
    refreshMap () {
      if (this.map) this.map.invalidateSize()
    },
    setupMap (domEl, options) {
      let viewerOptions = options || this.options.viewer
      // Initialize the map
      this.map = L.map(domEl, Object.assign({ zoomControl: false }, viewerOptions))
      bindLeafletEvents(this.map, LeafletEvents.Map, this, viewerOptions)
      this.$emit('map-ready')
    },
    processLeafletLayerOptions (options) {
      // Because we update objects in place and don't want leaflet internal objects to be reactive
      let processedOptions = _.cloneDeep(options)
      let leafletOptions = processedOptions.leaflet
      // Transform from string to actual objects when required in some of the layer options
      this.leafletObjectOptions.forEach(option => {
        if (typeof _.get(leafletOptions, option) === 'string') {
          // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
          _.set(leafletOptions, option, _.get(L, _.get(leafletOptions, option)))
        }
      })
      // Copy generic options
      leafletOptions.attribution = processedOptions.attribution
      return processedOptions
    },
    createLeafletPane (paneOrZIndex) {
      // Create pane if required
      const paneName = paneOrZIndex.toString()
      let pane = this.map.getPane(paneName)
      if (!pane) {
        pane = this.map.createPane(paneName)
        if (typeof paneOrZIndex === 'Number') _.set(pane, 'style.zIndex', paneOrZIndex)
        else _.set(pane, 'style.zIndex', 400) // Defaults for overlay in Leaflet
      }
      this.leafletPanes[paneName] = pane
      return pane
    },
    getLeafletPaneByName (paneOrZIndex) {
      const paneName = paneOrZIndex.toString()
      return this.leafletPanes[paneName]
    },
    removeLeafletPane (paneOrZIndex) {
      const paneName = paneOrZIndex.toString()
      const pane = this.getLeafletPaneByName(paneName)
      if (!pane) return
      delete this.leafletPanes[paneName]
    },
    updateLeafletPanesVisibility (panes) {
      const zoom = this.map.getZoom()
      // Check if we need to hide/show some panes based on current zoom level
      _.forOwn(this.leafletPanes, (pane, paneName) => {
        // Filter only some panes ?
        if (panes && panes.includes(paneName)) return
        _.set(pane, 'style.display', 'block')
        if (_.has(pane, 'minZoom') && (zoom < _.get(pane, 'minZoom'))) _.set(pane, 'style.display', 'none')
        if (_.has(pane, 'maxZoom') && (zoom > _.get(pane, 'maxZoom'))) _.set(pane, 'style.display', 'none')
      })
    },
    createLeafletLayer (options) {
      const leafletOptions = options.leaflet || options
      // Manage panes to make z-index work for all types of layers
      // Indeed, although DOM-based layers can use setZIndex() to manage rendering order
      // SVG/Canvas-based layers provide no mean to manage render order except using bringToFront() or bringToBack()
      // This is why Leaflet 1.0 introduced panes: https://leafletjs.com/reference.html#map-pane & https://leafletjs.com/examples/map-panes/
      // By implicitely create a pane for each provided z-index makes this transparent for the user
      let zIndex = _.has(leafletOptions, 'zIndex')
      if (zIndex) {
        zIndex = _.get(leafletOptions, 'zIndex')
        this.createLeafletPane(zIndex)
        // Set layer to use target pane
        _.set(leafletOptions, 'pane', zIndex.toString())
      }
      // Different panes inside a layer can be used to manage visibility according to zoom level
      let panes = _.get(leafletOptions, 'panes')
      if (panes) {
        panes.forEach(paneOptions => {
          let pane = this.createLeafletPane(paneOptions.name || paneOptions.zIndex)
          Object.assign(pane, paneOptions)
        })
        this.updateLeafletPanesVisibility(panes.map(paneOptions => paneOptions.name || paneOptions.zIndex.toString()))
      }
      
      let layer
      if (leafletOptions.source) {
        layer = _.get(L, leafletOptions.type)(leafletOptions.source, leafletOptions)
      }
      else {
        layer = _.get(L, leafletOptions.type)(leafletOptions)
      }
      return layer
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
        layer = await constructor(processedOptions)
        if (layer) break
      }
      // Use default Leaflet layer constructor if none found
      return (layer || this.createLeafletLayer(processedOptions))
    },
    hasLayer (name) {
      return _.has(this.layers, name)
    },
    isLayerVisible (name) {
      let leafetLayer = this.getLeafletLayerByName(name)
      return leafetLayer && this.map.hasLayer(leafetLayer)
    },
    getLayerByName (name) {
      return this.layers[name]
    },
    getLeafletLayerByName (name) {
      return this.leafletLayers[name]
    },
    async showLayer (name) {
      // Retrieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (this.isLayerVisible(name)) return
      layer.isVisible = true

      // Create the leaflet layer on first show
      let leafletLayer = this.getLeafletLayerByName(name)
      if (!leafletLayer) {
        leafletLayer = await this.createLayer(layer)
      }
      // Add the leaflet layer to the map
      this.leafletLayers[name] = leafletLayer
      this.map.addLayer(leafletLayer)

      // Ensure base layer will not pop on top of others
      if (layer.type === 'BaseLayer') leafletLayer.bringToBack()
      // Apply the current time if needed
      if (typeof leafletLayer.setCurrentTime === 'function') leafletLayer.setCurrentTime(this.currentTime)
      this.$emit('layer-shown', layer, leafletLayer)
    },
    hideLayer (name) {
      // Retrieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (!this.isLayerVisible(name)) return
      layer.isVisible = false
      // Remove the leaflet layer from map
      let leafletLayer = this.leafletLayers[name]
      this.map.removeLayer(leafletLayer)
      let panes = _.get(layer, 'leaflet.panes')
      if (panes) panes.forEach(pane => this.removeLeafletPane(pane.name || pane.zIndex))
      this.$emit('layer-hidden', layer, leafletLayer)
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
    renameLayer (previousName, newName) {
      const layer = this.getLayerByName(previousName)
      const leafletLayer = this.getLeafletLayerByName(previousName)
      if (!layer) return
      // Update underlying layer map if layer has been already shown
      if (leafletLayer) {
        this.leafletLayers[newName] = leafletLayer
        delete this.leafletLayers[previousName]
      }
      // Update underlying layer map, this one is reactive
      this.$set(this.layers, newName, layer)
      this.$delete(this.layers, previousName)
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
    toGeoJson (name) {
      const layer = this.getLeafletLayerByName(name)
      if (!layer || (typeof layer.toGeoJSON !== 'function')) return
      return layer.toGeoJSON()
    },
    zoomToLayer (name, options) {
      const layer = this.getLeafletLayerByName(name)
      if (!layer) return

      this.map.fitBounds(layer.getBounds(), options)
    },
    zoomToBounds (bounds) {
      this.map.fitBounds(bounds)
    },
    center (longitude, latitude, zoomLevel, options) {
      this.map.setView(new L.LatLng(latitude, longitude), zoomLevel || 12, options)
    },
    getCenter () {
      const center = this.map.getCenter()
      const zoom = this.map.getZoom()
      return {
        longitude: center.lng,
        latitude: center.lat,
        zoomLevel: zoom
      }
    },
    getBounds () {
      this.viewBounds = this.map.getBounds()
      const south = this.viewBounds.getSouth()
      const west = this.viewBounds.getWest()
      const north = this.viewBounds.getNorth()
      const east = this.viewBounds.getEast()
      return [ [south, west], [north, east] ]
    },
    setCursor (className) {
      L.DomUtil.addClass(this.map._container, className)
    },
    unsetCursor (className) {
      L.DomUtil.removeClass(this.map._container, className)
    },
    onCurrentMapTimeChanged (datetime) {
      _.forEach(this.leafletLayers, leafletLayer => {
        if (typeof leafletLayer.setCurrentTime === 'function') leafletLayer.setCurrentTime(datetime)
      })
    },
    onMapZoomChanged () {
      this.updateLeafletPanesVisibility()
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('map'))
  },
  created () {
    this.leafletLayers = {}
    this.leafletPanes = {}
    this.leafletFactory = []
    // Default Leaflet layer options requiring conversion from string to actual Leaflet objects
    this.leafletObjectOptions = ['crs', 'rendererFactory']
    this.$on('zoomend', this.onMapZoomChanged)
    this.$on('current-time-changed', this.onCurrentMapTimeChanged)
  },
  beforeDestroy () {
    Object.keys(this.layers).forEach((layer) => this.removeLayer(layer))
    this.$off('zoomend', this.onMapZoomChanged)
    this.$off('current-time-changed', this.onCurrentMapTimeChanged)
  },
  destroyed () {
    this.map.remove()
  }
}
