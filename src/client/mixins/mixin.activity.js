import _ from 'lodash'
import logger from 'loglevel'
import { Dialog } from 'quasar'

export default function (name) {
  return {
    data () {
      return {
        forecastModelHandlers: {},
        layerCategories: [],
        layerHandlers: {},
        variables: [],
        engine: 'leaflet',
        engineReady: false,
        engineContainerWidth: null,
        engineContainerHeight: null
      }
    },
    computed: {
      appName () {
        return this.$config('appName')
      },
      sideNavToggle () {
        return _.get(this, 'activityOptions.buttons', ['side-nav']).includes('side-nav')
      },
      panelToggle () {
        return _.get(this, 'activityOptions.buttons', ['panel']).includes('panel')
      },
      viewStyle () {
        return 'width: 100%; height: 100%; fontWeight: normal; zIndex: 0; position: absolute;'
      },
      variablesForCurrentLevel () {
        return this.variables.map(variable => Object.assign({ name: `${variable.name}-${this.forecastLevel}` }, _.omit(variable, ['name'])))
      },
      currentVariables () {
        return this.hasForecastLevels ? this.variablesForCurrentLevel : this.variables
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
          { name: 'geocode-button', label: this.$t('mixins.activity.GEOCODE_BUTTON'), color: 'primary', handler: () => this.onGeocode() }
        ]
      },
      registerActivityActions () {
        let defaultActions = ['fullscreen', 'geolocate', 'geocode', 'track-location', 'probe-location']
        if (this.engine === 'leaflet') defaultActions = defaultActions.concat(['create-layer'])
        const actions = _.get(this, 'activityOptions.actions', defaultActions)
        const hasFullscreenAction = (typeof this.onToggleFullscreen === 'function') && actions.includes('fullscreen')
        const hasLocationIndicatorAction = (typeof this.createLocationIndicator === 'function') && actions.includes('track-location')
        const hasProbeLocationAction = (typeof this.onProbeLocation === 'function') && actions.includes('probe-location') && this.weacastApi && this.forecastModel
        const hasCreateLayerAction = (typeof this.onCreateLayer === 'function') && actions.includes('create-layer')
        // FAB
        if (hasFullscreenAction) {
          this.registerFabAction({
            name: 'toggle-fullscreen', label: this.$t('mixins.activity.TOGGLE_FULLSCREEN'), icon: 'fullscreen', handler: this.onToggleFullscreen
          })
        }
        if (hasLocationIndicatorAction) {
          this.registerFabAction({
            name: 'track-location', label: this.$t('mixins.activity.TRACK_LOCATION'), icon: 'track_changes', handler: this.onTrackLocation
          })
        }
        if (hasProbeLocationAction) {
          this.registerFabAction({
            name: 'probe', label: this.$t('mixins.activity.PROBE'), icon: 'colorize', handler: this.onProbeLocation
          })
        }
        if (hasCreateLayerAction) {
          this.registerFabAction({
            name: 'create-layer', label: this.$t('mixins.activity.CREATE_LAYER'), icon: 'add', handler: this.onCreateLayer
          })
        }
      },
      async getCatalogLayers () {
        const catalogService = this.$api.getService('catalog')
        const response = await catalogService.find()
        return response.data
      },
      async refreshLayers () {
        this.layers = {}
        this.layerCategories = _.get(this, 'activityOptions.panel.categories', [])
        this.layerHandlers = {
          toggle: (layer) => this.onTriggerLayer(layer),
          'zoom-to': (layer) => this.onZoomToLayer(layer),
          save: (layer) => this.onSaveLayer(layer),
          edit: (layer) => this.onEditLayer(layer),
          'edit-data': (layer) => this.onEditLayerData(layer),
          remove: (layer) => this.onRemoveLayer(layer)
        }
        this.variables = []
        let catalogLayers = await this.getCatalogLayers()
        _.forEach(catalogLayers, (layer) => {
          if (layer[this.engine]) {
            // Process i18n
            if (this.$t(layer.name)) layer.name = this.$t(layer.name)
            if (this.$t(layer.description)) layer.description = this.$t(layer.description)
            // Check for Weacast API availability
            const isWeacastLayer = _.get(layer, `${this.engine}.type`, '').startsWith('weacast.')
            if (isWeacastLayer && (!this.weacastApi || !this.forecastModel)) return
            this.addLayer(layer)
          }
          // Filter layers with variables, not just visible ones because we might want to
          // probe weather even if there is no visual representation (e.g. in globe)
          if (layer.variables) this.variables = this.variables.concat(layer.variables)
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
        else return (!layer._id || (layer.service === 'features'))
      },
      registerLayerActions (layer) {
        let defaultActions = ['zoom-to', 'save', 'edit', 'remove']
        if (this.engine === 'leaflet') defaultActions = defaultActions.concat(['edit-data'])
        const layerActions = _.get(this, 'activityOptions.layerActions', defaultActions)
        let actions = []
        // Add supported actions
        if (layer.type === 'OverlayLayer') {
          if (layerActions.includes('zoom-to')) {
            actions.push({
              name: 'zoom-to',
              label: this.$t('mixins.activity.ZOOM_TO_LABEL'),
              icon: 'zoom_out_map'
            })
          }
          if (this.isLayerStorable(layer) && !layer._id && layerActions.includes('save')) {
            actions.push({
              name: 'save',
              label: this.$t('mixins.activity.SAVE_LABEL'),
              icon: 'save'
            })
          }
          if (this.isLayerEditable(layer) && layerActions.includes('edit')) {
            actions.push({
              name: 'edit',
              label: this.$t('mixins.activity.EDIT_LABEL'),
              icon: 'description'
            })
            // Supported by underlying engine ?
            if ((typeof this.editLayer === 'function') && layerActions.includes('edit-data')) {
              actions.push({
                name: 'edit-data',
                label: this.isLayerEdited(layer.name)
                  ? this.$t('mixins.activity.STOP_EDIT_DATA_LABEL')
                  : this.$t('mixins.activity.START_EDIT_DATA_LABEL'),
                icon: 'edit_location'
              })
            }
          }
          if (this.isLayerRemovable(layer) && layerActions.includes('remove')) {
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
        this.registerLayerActions(layer)
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
        let createdLayer = await this.$api.getService('catalog')
        .create(_.omit(layer, ['actions', 'isVisible']))
        // layer._id = createdLayer._id
        // this.registerLayerActions(layer) // Refresh actions due to state change
        // Because we save all features in a single service use filtering to separate layers
        // We use the generated DB ID as layer ID on features
        await this.createFeatures(this.toGeoJson(layer.name), createdLayer._id)
        // Update filter in layer as well
        createdLayer = await this.$api.getService('catalog').patch(createdLayer._id, { baseQuery: { layer: createdLayer._id } })
        // Reset layer with new setup
        await this.removeLayer(layer.name)
        await this.addLayer(createdLayer)
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
        this.registerLayerActions(layer) // Refresh actions due to state change
      },
      async onRemoveLayer (layer) {
        Dialog.create({
          title: this.$t('mixins.activity.REMOVE_DIALOG_TITLE', { layer: layer.name }),
          message: this.$t('mixins.activity.REMOVE_DIALOG_MESSAGE', { layer: layer.name }),
          html: true,
          ok: {
            label: this.$t('OK')
          },
          cancel: {
            label: this.$t('CANCEL')
          }
        }).onOk(async () => {
          // Stop any running edition
          if (this.isLayerEdited(layer.name)) await this.editLayer(layer.name)
          if (layer._id) {
            // If persistent feature layer remove features as well
            if (layer.service === 'features') {
              await this.removeFeatures(layer._id)
            }
            await this.$api.getService('catalog').remove(layer._id)
          }
          this.removeLayer(layer.name)
        })
      },
      onMapReady () {
        this.engineReady = true
        this.engine = 'leaflet'
      },
      onGlobeReady () {
        this.engineReady = true
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
              [this.engine]: {
                type: 'geoJson',
                isVisible: true,
                source: '/api/features',
                cluster: { disableClusteringAtZoom: 18 }
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
      onGeolocationError (error) {
        // Remove geolocation action if not allowed by user
        if (error.code === 'GEOLOCATION_PERMISSION_DENIED') {
          this.unregisterFabAction('geolocate')
        }
      },
      onCloseGeocoding (done) {
        this.geocodingModal.close(done)
        this.geocodingModal = null
      },
      /*async onGeocoding () {
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
      onGeocode () {
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
      },*/
      onTrackLocation () {
        if (!this.locationIndicator) this.createLocationIndicator()
        else this.removeLocationIndicator()
      },
      geolocate () {
        if (!this.engineReady) {
          // logger.error('Engine not ready to geolocate')
          return
        }
        if (_.get(this.$route, 'query.south')) return
        const position = this.$store.get('user.position')
        // 3D or 2D centering ?
        if (position) {
          this.center(position.longitude, position.latitude)
        }
      },
      onLocationChanged (location) {
        if (location) this.center(location.longitude, location.latitude)
      },
      getViewKey () {
        return this.appName.toLowerCase() + `-${this.name}-view`
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
      async initialize () {
        // Geolocate by default if view has not been restored
        if (!this.restoreView()) {
          if (this.$store.get('user.position')) this.geolocate()
        }
        // Retrieve the forecast models
        if (this.setupWeacast) {
          try {
            await this.setupWeacast(this.$config('weacast'))
          } catch (error) {
            logger.error(error)
          }
          this.forecastModelHandlers = { toggle: (model) => this.setForecastModel(model) }
        } else {
          this.forecastModelHandlers = {}
        }
        // Retrieve the layers
        try {
          await this.refreshLayers()
        } catch (error) {
          logger.error(error)
        }
        // TimeLine
        if (this.setupTimeline) this.setupTimeline()
      }
    },
    beforeCreate () {
      // Config options: to be done first based on specific config name setup
      this.name = name
      this.options = this.$config(`${this.name}`)
      this.activityOptions = Object.assign({
        panel: this.$config(`${this.name}Panel`)
      }, this.$config(`${this.name}Activity`))
    },
    created () {
      // Load the required components
      this.$options.components['k-location-bar'] = this.$load('KLocationBar')
      this.$options.components['k-modal'] = this.$load('frame/KModal')
      this.$options.components['k-form'] = this.$load('form/KForm')
    },
    mounted () {
      this.$on('map-ready', this.onMapReady)
      this.$on('globe-ready', this.onGlobeReady)
      this.$on('layer-added', this.onLayerAdded)
      this.$events.$on('user-position-changed', this.geolocate)
      // Whenever restore view settings are updated, update view as well
      this.$events.$on('restore-view-changed', this.updateViewSettings)
      this.$events.$on('error', this.onGeolocationError)
    },
    beforeDestroy () {
      this.$off('map-ready', this.onMapReady)
      this.$off('globe-ready', this.onGlobeReady)
      this.$off('layer-added', this.onLayerAdded)
      this.$events.$off('user-position-changed', this.geolocate)
      this.$events.$off('restore-view-changed', this.updateViewSettings)
      this.$events.$off('error', this.onGeolocationError)
    }
  }
}
