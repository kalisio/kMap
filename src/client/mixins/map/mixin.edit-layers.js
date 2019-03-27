import _ from 'lodash'
import L from 'leaflet'
import logger from 'loglevel'
import 'leaflet-draw/dist/leaflet.draw-src.js'
import 'leaflet-draw/dist/leaflet.draw-src.css'
import { bindLeafletEvents } from '../../utils'

let editLayersMixin = {
  methods: {
    isLayerEdited (name) {
      return this.editedLayer && (this.editedLayer.name === name)
    },
    editLayer (name) {
      let options = this.getLayerByName(name)
      let leafletLayer = this.getLeafletLayerByName(name)
      if (!options || !leafletLayer) return
      
      if (this.editControl) { // Stop edition
        // Remove UI
        this.map.removeControl(this.editControl)
        this.editControl = null
        // Set back edited layers to source layer
        this.editableLayers.getLayers().forEach(layer => leafletLayer.addLayer(layer))
        // Required on clusters to apply changes ?
        //if (typeof leafletLayer.refreshClusters === 'function') leafletLayer.refreshClusters()
        this.editableLayers.clearLayers()
        this.map.removeLayer(this.editableLayers)
        this.editedLayer = null
      } else { // Start edition
        this.editedLayer = options
        // Move source layers to edition layers, required as eg clusters are not supported
        let geoJson = leafletLayer.toGeoJSON()
        leafletLayer.clearLayers()
        this.editableLayers = new L.geoJson(geoJson, this.getGeoJsonOptions(options))
        this.map.addLayer(this.editableLayers)
        // Add UI
        this.editControl = new L.Control.Draw({
          position: 'bottomleft',
          draw: this.editOptions,
          edit: {
            featureGroup: this.editableLayers,
            remove: true
          }
        })
        this.map.addControl(this.editControl)
        this.createdFeatures = []
        this.editedFeatures = []
        this.deletedFeatures = []
      }
    },
    onFeatureCreated (event) {
      this.editableLayers.addLayer(event.layer)
      this.createdFeatures.push(event.layer.toGeoJSON())
    },
    onFeaturesEdited (event) {
      const geoJson = event.layers.toGeoJSON()
      if (geoJson.type === 'FeatureCollection') this.editedFeatures = this.editedFeatures.concat(geoJson.features)
      else this.editedFeatures.push(geoJson)
    },
    onFeaturesDeleted (event) {
      const geoJson = event.layers.toGeoJSON()
      if (geoJson.type === 'FeatureCollection') this.deletedFeatures = this.deletedFeatures.concat(geoJson.features)
      else this.deletedFeatures.push(geoJson)
    }
  },
  beforeCreate () {
    this.editOptions = {
      polyline: {},
      polygon: {
        allowIntersection: false, // Restricts shapes to simple polygons
      },
      circle: {},
      rectangle: {},
      marker: {},
      circlemarker: false
    }
  },
  mounted () {
    // Initialize i18n
    L.drawLocal = this.$t('mixins.editLayers', { returnObjects: true })
    this.$on('map-ready', () => {
      // Setup event binding
      bindLeafletEvents(this.map, _.values(L.Draw.Event), this)
    })
    this.$on('draw:created', this.onFeatureCreated)
    this.$on('draw:edited', this.onFeaturesEdited)
    this.$on('draw:deleted', this.onFeaturesDeleted)
  },
  beforeDestroy () {
    this.$off('draw:created', this.onFeatureCreated)
    this.$off('draw:edited', this.onFeaturesEdited)
    this.$off('draw:deleted', this.onFeaturesDeleted)
  }
}

export default editLayersMixin
