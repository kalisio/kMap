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
    async editLayer (name) {
      let options = this.getLayerByName(name)
      let leafletLayer = this.getLeafletLayerByName(name)
      if (!options || !leafletLayer) return
      
      if (this.editControl) { // Stop edition
        // Remove UI
        this.map.removeControl(this.editControl)
        this.editControl = null
        // Set back edited layers to source layer
        this.map.removeLayer(this.editableLayer)
        leafletLayer.addLayer(this.editableLayer)
        this.editedLayer = null
        this.editedLayerSchema = null
        this.deleteInProgress = false
      } else { // Start edition
        this.editedLayer = options
        // Move source layers to edition layers, required as eg clusters are not supported
        let geoJson = leafletLayer.toGeoJSON()
        leafletLayer.clearLayers()
        this.editableLayer = new L.geoJson(geoJson, this.getGeoJsonOptions(options))
        this.map.addLayer(this.editableLayer)
        // Add UI
        this.editControl = new L.Control.Draw({
          position: 'bottomleft',
          draw: this.editOptions,
          edit: {
            featureGroup: this.editableLayer,
            remove: true
          }
        })
        this.map.addControl(this.editControl)
        this.createdFeatures = []
        this.editedFeatures = []
        this.deletedFeatures = []
        this.editedLayerSchema = await this.loadLayerSchema(this.editedLayer)
      }
    },
    async loadLayerSchema (layer) {
      const schemaId = _.get(layer, 'schema._id')
      if (!schemaId) return null
      const data = await this.$api.getService('storage', '').get(schemaId)
      if (!data.uri) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      const typeAndData = data.uri.split(',')
      if (typeAndData.length <= 1) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      // We get data as a data URI
      return atob(typeAndData[1])
    },
    async onUpdateFeatureProperties (layer, event) {
      const leafletLayer = event.target
      if (!leafletLayer) return
      let feature = _.get(leafletLayer, 'feature')
      if (!feature || !this.isLayerEdited(layer.name)) return
      if (!this.editedLayerSchema) return // No edition schema
      // Check if not currently in the edition workspace for removal
      if (this.deleteInProgress) return
      // Avoid default popup
      const popup = leafletLayer.getPopup()
      if (popup) leafletLayer.unbindPopup(popup)
      
      this.editFeatureModal = await this.$createComponent('editor/KModalEditor', {
        propsData: {
          service: 'features',
          objectId: feature._id,
          schemaJson: this.editedLayerSchema,
          perspective: 'properties'
        }
      })
      this.editFeatureModal.$mount()
      this.editFeatureModal.open()
      this.editFeatureModal.$on('applied', async updatedFeature => {
        const updatedProperties = _.pick(updatedFeature, ['properties'])
        // Restore popup
        if (popup) leafletLayer.bindPopup(popup)
        // Save in DB and in memory
        await this.$api.getService('features').patch(feature._id, updatedProperties)
        let geoJson = leafletLayer.toGeoJSON()
        Object.assign(geoJson, updatedProperties)
        this.editableLayer.removeLayer(leafletLayer)
        this.editableLayer.addData(geoJson)
        this.editFeatureModal.close()
        this.editFeatureModal = null
      })
    },
    async onFeatureCreated (event) {
      let geoJson = event.layer.toGeoJSON()
      // Save changes to DB, we use the layer DB ID as layer ID on features
      geoJson.layer = this.editedLayer._id
      geoJson = await this.$api.getService('features').create(geoJson)
      this.editableLayer.addData(geoJson)
    },
    async onFeaturesEdited (event) {
      const geoJson = event.layers.toGeoJSON()
      const features = (geoJson.type === 'FeatureCollection' ? geoJson.features : [geoJson])
      // Save changes to DB
      for (let i = 0; i < features.length; i++) {
        const feature = features[i]
        await this.$api.getService('features').patch(feature._id, _.pick(feature, ['geometry']))
      }
    },
    async onFeaturesDeleted (event) {
      const geoJson = event.layers.toGeoJSON()
      const features = (geoJson.type === 'FeatureCollection' ? geoJson.features : [geoJson])
      // Save changes to DB
      for (let i = 0; i < features.length; i++) {
        const feature = features[i]
        await this.$api.getService('features').remove(feature._id)
      }
    },
    onStartDelete () {
      this.deleteInProgress = true
    },
    onStopDelete () {
      this.deleteInProgress = false
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
    this.$on('click', this.onUpdateFeatureProperties)
    this.$on('draw:deletestart', this.onStartDelete)
    this.$on('draw:deletestop', this.onStopDelete)
    this.$on('draw:created', this.onFeatureCreated)
    this.$on('draw:edited', this.onFeaturesEdited)
    this.$on('draw:deleted', this.onFeaturesDeleted)
  },
  beforeDestroy () {
    this.$off('click', this.onUpdateFeatureProperties)
    this.$off('draw:deletestart', this.onStartDelete)
    this.$off('draw:deletestop', this.onStopDelete)
    this.$off('draw:created', this.onFeatureCreated)
    this.$off('draw:edited', this.onFeaturesEdited)
    this.$off('draw:deleted', this.onFeaturesDeleted)
  }
}

export default editLayersMixin
