import _ from 'lodash'
import config from 'config'
import logger from 'loglevel'
import moment from 'moment'
import { Events, Dialog } from 'quasar'

export default {
  data () {
    return {
      forecastModelHandlers: {},
      layerCategories: [],
      layerHandlers: {},
      engine: null
    }
  },
  methods: {
    getGeocodingToolbar () {
      return [
        { name: 'close-action', label: this.$t('mixins.activity.CLOSE_GEOCODING_ACTION'), icon: 'close', handler: this.onCloseGeocoding }
      ]
    },
    getGeocodingButtons () {
      return [
        { name: 'geocode-button', label: this.$t('mixins.activity.GEOCODE_BUTTON'), color: 'primary', handler: (event, done) => this.onGeocode(done) }
      ]
    },
    registerActivityActions () {
      // FAB
      if (this.onToggleFullscreen) this.registerFabAction({
        name: 'toggle-fullscreen', label: this.$t('mixins.activity.TOGGLE_FULLSCREEN'), icon: 'fullscreen', handler: this.onToggleFullscreen
      })
      if (this.onGeolocate) this.registerFabAction({
        name: 'geolocate', label: this.$t('mixins.activity.GEOLOCATE'), icon: 'my_location', handler: this.onGeolocate
      })
      if (this.onGeocoding) this.registerFabAction({
        name: 'geocode', label: this.$t('mixins.activity.GEOCODE'), icon: 'location_searching', handler: this.onGeocoding
      })
      if (this.createLocationIndicator) this.registerFabAction({
        name: 'track-location', label: this.$t('mixins.activity.TRACK_LOCATION'), icon: 'track_changes', handler: this.onTrackLocation
      })
      if (this.onProbeLocation) this.registerFabAction({
        name: 'probe', label: this.$t('mixins.activity.PROBE'), icon: 'colorize', handler: this.onProbeLocation
      })
      if (this.onCreateLayer) this.registerFabAction({
        name: 'create-layer', label: this.$t('mixins.activity.CREATE_LAYER'), icon: 'add', handler: this.onCreateLayer
      })
    },
    async getCatalogLayers () {
      const catalogService = this.$api.getService('catalog')
      const response = await catalogService.find()
      return response.data
    },
    async refreshLayers (engine) {
      this.layers = {}
      this.layerCategories = (engine === 'leaflet' ? this.$config('mapPanel.categories') : this.$config('globePanel.categories'))
      this.layerHandlers = {
        toggle: (layer) => this.onTriggerLayer(layer),
        zoomTo: (layer) => this.onZoomToLayer(layer),
        save: (layer) => this.onSaveLayer(layer),
        edit: (layer) => this.onEditLayer(layer),
        editData: (layer) => this.onEditLayerData(layer),
        remove: (layer) => this.onRemoveLayer(layer)
      }
      let catalogLayers = await this.getCatalogLayers()
      _.forEach(catalogLayers, (layer) => {
        if (layer[engine]) {
          // Process i18n
          if (this.$t(layer.name)) layer.name = this.$t(layer.name)
          if (this.$t(layer.description)) layer.description = this.$t(layer.description)
          this.addLayer(layer)
        }
      })
      // We need at least an active background
      const hasVisibleBaseLayer = catalogLayers.find((layer) => (layer.type === 'BaseLayer') && layer.isVisible)
      if (!hasVisibleBaseLayer) {
        const baseLayer = catalogLayers.find((layer) => (layer.type === 'BaseLayer'))
        if (baseLayer) this.showLayer(baseLayer.name)
      }
    },
    isLayerStorable (layer) {
      if (_.has(layer, 'isStorable')) return _.get(layer, 'isStorable')
      // Only possible when export as GeoJson is possible by default
      else return (!layer._id && (typeof this.toGeoJson === 'function'))
    },
    isLayerEditable (layer) {
      if (_.has(layer, 'isEditable')) return _.get(layer, 'isEditable')
      // Only possible on user-defined and saved layers by default
      else return (layer._id && (layer.service === 'features'))
    },
    isLayerRemovable (layer) {
      if (_.has(layer, 'isRemovable')) return _.get(layer, 'isRemovable')
      // Only possible on user-defined layers by default
      else return (!layer._id && (layer.service === 'features'))
    },
    setupLayerActions (layer) {
      let actions = []
      // Add supported actions
      if (layer.type === 'OverlayLayer') {
        actions.push({
          name: 'zoomTo',
          label: this.$t('mixins.activity.ZOOM_TO_LABEL'),
          icon: 'zoom_out_map'
        })
        if (this.isLayerStorable(layer) && !layer._id) {
          actions.push({
            name: 'save',
            label: this.$t('mixins.activity.SAVE_LABEL'),
            icon: 'save'
          })
        }
        if (this.isLayerEditable(layer)) {
          actions.push({
            name: 'edit',
            label: this.$t('mixins.activity.EDIT_LABEL'),
            icon: 'description'
          })
          // Supported by underlying engine ?
          if (typeof this.editLayer === 'function') {
            actions.push({
              name: 'editData',
              label: this.isLayerEdited(layer.name) ?
                this.$t('mixins.activity.STOP_EDIT_DATA_LABEL') :
                this.$t('mixins.activity.START_EDIT_DATA_LABEL'),
              icon: 'edit_location'
            })
          }
        }
        if (this.isLayerRemovable(layer)) {
          actions.push({
            name: 'remove',
            label: this.$t('mixins.activity.REMOVE_LABEL'),
            icon: 'remove_circle'
          })
        }
      }
      this.$set(layer, 'actions', actions)
    },
    onLayerAdded (layer) {
      this.setupLayerActions(layer)
    },
    onTriggerLayer (layer) {
      if (!this.isLayerVisible(layer.name)) {
        this.showLayer(layer.name)
      } else {
        this.hideLayer(layer.name)
      } 
    },
    onZoomToLayer (layer) {
      this.zoomToLayer(layer.name)
    },
    async onSaveLayer (layer) {
      // Change data source from in-memory to features service
      _.merge(layer, {
        service: 'features',
        [this.engine]: { source: '/api/features' }
      })
      // When saving from one engine copy options to the other one so that it will be available in both of them
      _.set(layer, (this.engine === 'leaflet' ? 'cesium' : 'leaflet'), _.get(layer, this.engine))
      const createdLayer = await this.$api.getService('catalog')
      .create(_.omit(layer, ['actions', 'isVisible']))
      layer._id = createdLayer._id
      this.setupLayerActions(layer) // Refresh actions due to state change
      // Because we save all features in a single service use filtering to separate layers
      // We use the generated DB ID as layer ID on features
      let geoJson = this.toGeoJson(layer.name)
      geoJson.features.forEach(feature => feature.layer = createdLayer._id)
      await this.$api.getService('features').create(geoJson.features)
      // Update filter in layer as well
      await this.$api.getService('catalog').patch(createdLayer._id, { baseQuery: { layer: createdLayer._id } })
    },
    async onEditLayer (layer) {
      this.editModal = await this.$createComponent('editor/KModalEditor', {
        propsData: {
          service: 'catalog',
          contextId: this.contextId,
          objectId: layer._id
        }
      })
      this.editModal.$mount()
      this.editModal.open()
      this.editModal.$on('applied', updatedLayer => {
        // If renamed need to update the layer map accordingly
        if (layer.name !== updatedLayer.name) {
          this.renameLayer(layer.name, updatedLayer.name)
        }
        Object.assign(layer, updatedLayer)
        this.editModal.close()
        this.editModal = null
      })
    },
    async onEditLayerData (layer) {
      // Start/Stop edition
      this.editLayer(layer.name)
      this.setupLayerActions(layer) // Refresh actions due to state change
    },
    async onRemoveLayer (layer) {
      Dialog.create({
        title: this.$t('mixins.activity.REMOVE_DIALOG_TITLE', { layer: layer.name }),
        message: this.$t('mixins.activity.REMOVE_DIALOG_MESSAGE', { layer: layer.name }),
        buttons: [
          {
            label: this.$t('OK'),
            handler: async () => {
              // Stop any running edition
              if (this.isLayerEdited(layer.name)) await this.editLayer(layer.name)
              if (layer._id) {
                // If persistent feature layer remove features as well
                if (layer.service === 'features') {
                  await this.$api.getService('features').remove(null, { query: { layer: layer._id } })
                }
                await this.$api.getService('catalog').remove(layer._id)
              }
              this.removeLayer(layer.name)
            }
          }, {
            label: this.$t('CANCEL')
          }
        ]
      })
    },
    onForecastModelSelected (model) {
      this.forecastModel = model
    },
    onMapReady () {
      this.engine = 'leaflet'
    },
    onGlobeReady () {
      this.engine = 'cesium'
    },
    async onCreateLayer () {
      // Set layer data source to features service
      this.createModal = await this.$createComponent('editor/KModalEditor', {
        propsData: {
          service: 'catalog',
          contextId: this.contextId,
          baseObject: {
            type: 'OverlayLayer',
            icon: 'insert_drive_file',
            service: 'features',
            isStorable: true,
            isEditable: true,
            isRemovable: true,
            [this.engine]: {
              type: 'geoJson',
              isVisible: true,
              source: '/api/features'
            }
          }
        }
      })
      this.createModal.$mount()
      this.createModal.open()
      this.createModal.$on('applied', async createdLayer => {
        this.createModal.close()
        this.createModal = null
        // Create an empty layer used as a container
        await this.addLayer(createdLayer)
        // Start editing
        await this.onEditLayerData(createdLayer)
      })
    },
    onGeolocate () {
      // Force a refresh
      this.clearStoredView()
      this.updatePosition()
    },
    onCloseGeocoding (done) {
      this.geocodingModal.close(done)
      this.geocodingModal = null
    },
    async onGeocoding () {
      const schema = await this.$load('geocoding', 'schema')
      this.geocodingModal = await this.$createComponent('frame/KModal', {
        propsData: {
          title: this.$t('mixins.activity.GEOCODING'),
          toolbar: this.getGeocodingToolbar(),
          buttons: this.getGeocodingButtons(),
          route: false
        }
      })
      // Slots require VNodes not components
      this.geocodingModal.$slots['modal-content'] = [
        await this.$createComponentVNode('form/KForm', { props: { schema } })
      ]
      this.geocodingModal.$mount()
      this.geocodingModal.open()
    },
    onGeocode (done) {
      const geocodingForm = _.get(this.geocodingModal.$slots, 'modal-content[0].componentInstance')
      if (geocodingForm) {
        let result = geocodingForm.validate()
        const longitude = _.get(result, 'values.location.longitude')
        const latitude = _.get(result, 'values.location.latitude')
        if (longitude && latitude) {
          this.center(longitude, latitude)
        }
      }
      this.onCloseGeocoding(done)
    },
    onTrackLocation () {
      if (!this.locationIndicator) this.createLocationIndicator()
      else this.removeLocationIndicator()
    },
    geolocate () {
      if (!this.engine) {
        //logger.error('Engine not ready to geolocate')
        return
      }
      if (_.get(this.$route, 'query.south')) return
      const position = this.$store.get('user.position')
      // 3D or 2D centering ?
      if (position) {
        this.center(position.longitude, position.latitude)
      }
    },
    getViewKey () {
      return config.appName.toLowerCase() + '-view'
    },
    storeView () {
      const bounds = this.getBounds()
      const south = bounds[0][0]
      const west = bounds[0][1]
      const north = bounds[1][0]
      const east = bounds[1][1]
      // Store both in URL and local storage, except if the user has explicitly revoked restoration
      const restoreView = this.$store.get('restore.view')
      if (restoreView) {
        this.$router.push({ query: { south, west, north, east } })
        window.localStorage.setItem(this.getViewKey(), JSON.stringify(bounds))
      }
    },
    restoreView () {
      let bounds
      const restoreView = this.$store.get('restore.view')
      if (restoreView) {
        const savedBounds = window.localStorage.getItem(this.getViewKey())
        if (savedBounds) bounds = JSON.parse(savedBounds)
      } else if (_.get(this.$route, 'query.south') && _.get(this.$route, 'query.west') &&
                 _.get(this.$route, 'query.north') && _.get(this.$route, 'query.east')) {
        bounds = [
          [_.get(this.$route, 'query.south'), _.get(this.$route, 'query.west')],
          [_.get(this.$route, 'query.north'), _.get(this.$route, 'query.east')]
        ]
      }
      // Restore state if required
      if (bounds) {
        const south = bounds[0][0]
        const west = bounds[0][1]
        const north = bounds[1][0]
        const east = bounds[1][1]
        this.$router.push({ query: { south, west, north, east } })
        this.zoomToBounds(bounds)
      }
      return bounds
    },
    clearStoredView () {
      this.$router.push({ query: {} })
      window.localStorage.removeItem(this.getViewKey())
    },
    updateViewSettings () {
      this.clearStoredView()
      this.restoreView()
    },
    async initializeView () {
      // Geolocate by default if view has not been restored
      if (!this.restoreView()) {
        if (this.$store.get('user.position')) this.geolocate()
      }
      // Retrieve the layers
      try {
        await this.refreshLayers(this.engine)
      } catch (error) {
        logger.error(error)
      }
      // Retrieve the forecast models
      if (this.setupWeacast) {
        try {
          await this.setupWeacast(this.$config('weacast'))
        } catch (error) {
          logger.error(error)
        }
        this.forecastModelHandlers = { toggle: (model) => this.onForecastModelSelected(model) }
      } else {
        this.forecastModelHandlers = {}
      }
      // TimeLine
      if (this.setupTimeline) this.setupTimeline()
    },
    async createProbedLocationLayer () {
      if (!this.probedLocation) return
      const name = this.$t('mixins.activity.PROBED_LOCATION')
      // Use wind barbs on weather probed features
      const isWeatherProbe = (_.has(this.probedLocation, 'properties.windDirection') &&
                              _.has(this.probedLocation, 'properties.windSpeed'))
      // Get any previous layer or create it the first time
      let layer = this.getLayerByName(name)
      if (!layer) {
        await this.addLayer({
          name,
          type: 'OverlayLayer',
          icon: 'colorize',
          isStorable: false,
          isEditable: false,
          isRemovable: true,
          leaflet: {
            type: 'geoJson',
            isVisible: true,
            realtime: true,
            popup: { pick: [] }
          },
          cesium: {
            type: 'geoJson',
            isVisible: true,
            realtime: true,
            popup: { pick: [] }
          }
        })
      }
      // Update data
      this.updateLayer(name, isWeatherProbe ?
        this.getProbedLocationForecastAtCurrentTime() :
        this.getProbedLocationMeasureAtCurrentTime())
    },
    getTimeLineInterval () {
      // interval length: length of 1 day in milliseconds
      const length = 24 * 60 * 60000

      return {
        length,
        getIntervalStartValue (rangeStart) {
          let startTime = moment.utc(rangeStart)
          startTime.local()
          const hour = startTime.hours()
          const minute = startTime.minutes()
          let startValue
          // range starts on a day (ignoring seconds)
          if (hour == 0 && minute == 0) {
            startValue = rangeStart
          } else {
            let startOfDay = startTime.startOf('day')
            startOfDay.add({ days: 1 })
            startValue = startOfDay.valueOf()
          } 
          return startValue
        },
        valueChanged (value, previousValue, step) {
          let changed = true
          if (step !== null) {
            changed = false
            if (previousValue === null) {
              changed = true
            } else {
              const difference = Math.abs(value - previousValue)
              switch (step) {
                case 'h':
                  changed = (difference >= 60 * 60000)
                  break
                case 'm':
                  changed = (difference >= 60000)   
                  break
                default:
                  changed = true
              }
            }
          }
          return changed
        }
      }
    },
    getTimeLineFormatter () {
      return {
        format: (value, type, displayOptions) => {
          const time = new Date(value)
          let label
          switch (type) {
            case 'interval':
              if (displayOptions.width >= 110) {
                label = this.formatTime('date.long', time)
              } else {
                label = this.formatTime('date.short', time)
              }
              break 
            case 'pointer':
              label = `${this.formatTime('date.long', time)} - ${this.formatTime('time.short', time)}`
              break 
            case 'indicator':
              label = this.formatTime('time.short', time)
              break 
          }
          return label
        }        
      }
    }
  },
  beforeCreate () {   
  },
  created () {
    // Load the required components
    this.$options.components['k-modal'] = this.$load('frame/KModal')
    this.$options.components['k-form'] = this.$load('form/KForm')
  },
  mounted () {
    this.$on('map-ready', this.onMapReady)
    this.$on('globe-ready', this.onGlobeReady)
    this.$on('layer-added', this.onLayerAdded)
    Events.$on('user-position-changed', this.geolocate)
    // Whenever restore view settings are updated, update view as well
    Events.$on('restore-view-changed', this.updateViewSettings)
  },
  beforeDestroy () {
    this.$off('map-ready', this.onMapReady)
    this.$off('globe-ready', this.onGlobeReady)
    this.$off('layer-added', this.onLayerAdded)
    Events.$off('user-position-changed', this.geolocate)
    Events.$off('restore-view-changed', this.updateViewSettings)
  }
}
