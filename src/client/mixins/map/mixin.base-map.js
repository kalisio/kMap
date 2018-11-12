import _ from 'lodash'
import moment, { relativeTimeRounding } from 'moment'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// This ensure we have all required plugins
import 'leaflet-fa-markers/L.Icon.FontAwesome.css'
import 'leaflet-fa-markers/L.Icon.FontAwesome.js'
import 'leaflet-realtime'
import 'leaflet-timedimension/dist/leaflet.timedimension.src.js'
import 'leaflet-timedimension/dist/leaflet.timedimension.control.css'
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
      this.map = L.map('map').setView([46, 1.5], 5)
      this.$emit('map-ready')
    },
    createLayer (options) {
      // Because we update objects in place
      const layerConfiguration = _.cloneDeep(options)
      const objectOptions = ['crs', 'rendererFactory']
      // Transform from string to actual objects when required in some of the layer options
      objectOptions.forEach(option => {
        // Find the right argument holding the option
        let options = _.find(layerConfiguration.arguments, argument => typeof _.get(argument, option) === 'string')
        if (options) {
          // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
          _.set(options, option, _.get(L, _.get(options, option)))
        }
      })
      let type = layerConfiguration.type
      let container
      // Specific case of realtime layer where we first need to create an underlying container or setup Id function
      if ((type === 'realtime') && (layerConfiguration.arguments.length > 1)) {
        let options = layerConfiguration.arguments[1]
        const id = _.get(options, 'id')
        if (id) _.set(options, 'getFeatureId', (feature) => _.get(feature, id))
        let container = _.get(options, 'container')
        if (container) {
          options.container = container = _.get(L, container)()
        }
        if (this.getGeoJsonOptions && options) _.assign(options, this.getGeoJsonOptions())
      }
      // Specific case of timedimension layer where we first need to create an underlying WMS layer
      if (type === 'timeDimension.layer.wms') {
        type = 'tileLayer.wms'
      }
      let layer = _.get(L, type)(...layerConfiguration.arguments)
      // Specific case of realtime layer where the underlying container also need to be added to map
      if (container) {
        layer.once('add', () => container.addTo(this.map))
      }
      // Specific case of timedimension layer where we embed the underlying WMS layer
      if (layerConfiguration.type === 'timeDimension.layer.wms') {
        return L.timeDimension.layer.wms(layer)
      } else {
        return layer
      }
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
  },
  beforeDestroy () {
    Object.keys(this.layers).forEach((layer) => this.removeLayer(layer))
    this.map.remove()
  }
}

export default baseMapMixin
