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
        this.deleteInProgress = false
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
    async onUpdateFeatureProperties (layer, event) {
      const feature = _.get(event, 'target.feature')
      if (!feature || !this.isLayerEdited(layer.name)) return
      if (!layer.schema) return // No edition schema
      // Check if not currently in the edition workspace for removal
      if (this.deleteInProgress) return
      // Avoid default popup
      const popup = event.target.getPopup()
      if (popup) event.target.unbindPopup(popup)
      const data = await this.$api.getService('storage', '').get(`schemas/${layer._id}.json`)
      if (!data.uri) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      const typeAndData = data.uri.split(',')
      if (typeAndData.length <= 1) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      // We get data as a data URI
      const schema = atob(typeAndData[1])
      this.editFeatureModal = await this.$createComponent('editor/KModalEditor', {
        propsData: {
          service: 'features',
          objectId: feature._id,
          schemaJson: schema,
          perspective: 'properties'
        }
      })
      this.editFeatureModal.$mount()
      this.editFeatureModal.open()
      this.editFeatureModal.$on('applied', async updatedFeature => {
        // Restore popup
        if (popup) event.target.bindPopup(popup)
        await this.$api.getService('features').patch(feature._id, _.pick(updatedFeature, ['properties']))
        this.editFeatureModal.close()
        this.editFeatureModal = null
      })
    },
    async onFeatureCreated (event) {
      let geoJson = event.layer.toGeoJSON()
      // Save changes to DB, we use the layer DB ID as layer ID on features
      geoJson.layer = this.editedLayer._id
      geoJson = await this.$api.getService('features').create(geoJson)
      this.editableLayers.addData(geoJson)
    },
    async onFeaturesEdited (event) {
      const geoJson = event.layers.toGeoJSON()
      const features = (geoJson.type === 'FeatureCollection' ? geoJson.features : [geoJson])
      // Save changes to DB
      for (let i = 0; i < features.length; i++) {
        const feature = features[i]
        await this.$api.getService('features').patch(feature._id, _.pick(feature, ['properties', 'geometry']))
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
