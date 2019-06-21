import _ from 'lodash'
import Cesium from 'cesium/Source/Cesium.js'
import 'cesium/Source/Widgets/widgets.css'
import BuildModuleUrl from 'cesium/Source/Core/buildModuleUrl'
import { convertCesiumHandlerEvent } from '../../utils'
// Cesium has its own dynamic module loader requiring to be configured
// Cesium files need to be also added as static assets of the applciation
BuildModuleUrl.setBaseUrl('./statics/Cesium/')

let baseGlobeMixin = {
  data () {
    return {
      layers: {}
    }
  },
  methods: {
    refreshGlobe () {
    },
    setupGlobe (domEl, token, options) {
      let viewerOptions = options || this.options.viewer
      if (token) Cesium.Ion.defaultAccessToken = token
      // Initialize the globe
      Object.assign(viewerOptions, {
        imageryProviderViewModels: [],
        terrainProviderViewModels: []
      })
      this.viewer = new Cesium.Viewer(domEl, viewerOptions)
      // Cesium always create a default provider
      this.viewer.scene.imageryLayers.removeAll()
      // Add defaults handler
      this.registerCesiumHandler(this.getDefaultPickHandler, 'MOUSE_MOVE')
      this.registerCesiumHandler(this.getDefaultPickHandler, 'LEFT_CLICK')
      this.registerCesiumHandler(this.getDefaultPickHandler, 'RIGHT_CLICK')
      // Remove default Cesium handlers
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      this.viewBounds = new Cesium.Rectangle()
      this.$emit('globe-ready')
    },
    processCesiumLayerOptions (options) {
      // Because we update objects in place and don't want cesium internal objects to be reactive
      let processedOptions = _.cloneDeep(options)
      // Transform from string to actual object
      processedOptions.cesium.iconUrl = Cesium.buildModuleUrl(processedOptions.iconUrl)
      // Copy generic options
      processedOptions.cesium.name = processedOptions.name
      processedOptions.cesium.attribution = processedOptions.attribution
      return processedOptions
    },
    isTerrainLayer (options) {
      return (options.type === 'Cesium') || (options.type === 'Ellipsoid')
    },
    createCesiumLayer (options) {
      const cesiumOptions = options.cesium || options
      let provider
      if (this.isTerrainLayer(cesiumOptions)) {
        if (cesiumOptions.url || (cesiumOptions.type === 'Ellipsoid')) provider = cesiumOptions.type + 'TerrainProvider'
        // If no url given will use default terrain creation function createWorldTerrain()
        else provider = 'WorldTerrain'
      } else {
        provider = cesiumOptions.type + 'ImageryProvider'
      }
      // Handle specific case of built-in creation functions
      const createFunction = 'create' + provider
      provider = (Cesium[createFunction] ? Cesium[createFunction](cesiumOptions) : new Cesium[provider](cesiumOptions))
      // Terrain is directly managed using a provider
      return (this.isTerrainLayer(cesiumOptions) ? provider : new Cesium.ImageryLayer(provider))
    },
    registerCesiumConstructor (constructor) {
      this.cesiumFactory.push(constructor)
    },
    registerCesiumHandler (handler, eventType) {
      if (!this.cesiumHandler) this.cesiumHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      const originalEvent = convertCesiumHandlerEvent(eventType)
      this.cesiumHandler.setInputAction((event) => handler(Object.assign(event, { originalEvent })),
        Cesium.ScreenSpaceEventType[eventType])
    },
    unregisterCesiumHandler (eventType) {
      this.cesiumHandlers.removeInputAction(Cesium.ScreenSpaceEventType[eventType])
    },
    async createLayer (options) {
      let processedOptions = this.processCesiumLayerOptions(options)
      let layer
      // Iterate over all registered constructors until we find one
      for (let i = 0; i < this.cesiumFactory.length; i++) {
        const constructor = this.cesiumFactory[i]
        layer = await constructor(processedOptions)
        if (layer) break
      }
      // Use default Cesium layer constructor if none found
      layer = layer || this.createCesiumLayer(processedOptions)
      // Keep track of processed options
      layer.processedOptions = processedOptions
      return layer
    },
    hasLayer (name) {
      return _.has(this.layers, name)
    },
    isLayerVisible (name) {
      let layer = this.getLayerByName(name)
      if (!layer) return false
      let cesiumLayer = this.getCesiumLayerByName(name)
      if (this.isTerrainLayer(layer.cesium)) {
        return this.viewer.terrainProvider === cesiumLayer
      } else if (cesiumLayer instanceof Cesium.ImageryLayer) {
        return this.viewer.scene.imageryLayers.contains(cesiumLayer)
      } else {
        return this.viewer.dataSources.contains(cesiumLayer)
      }
    },
    getLayerByName (name) {
      return this.layers[name]
    },
    getCesiumLayerByName (name) {
      return this.cesiumLayers[name]
    },
    async showLayer (name) {
      // Retieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (this.isLayerVisible(name)) return
      layer.isVisible = true
      // Create the Cesium layer on first show
      let cesiumLayer = this.getCesiumLayerByName(name)
      if (!cesiumLayer) cesiumLayer = await this.createLayer(layer)
      // Add the cesium layer to the globe
      this.cesiumLayers[name] = cesiumLayer
      if (this.isTerrainLayer(layer.cesium)) {
        this.viewer.terrainProvider = cesiumLayer
      } else if (cesiumLayer instanceof Cesium.ImageryLayer) {
        this.viewer.scene.imageryLayers.add(cesiumLayer)
      } else {
        this.viewer.dataSources.add(cesiumLayer)
      }
      this.$emit('layer-shown', layer, cesiumLayer)
    },
    hideLayer (name) {
      // retrieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (!this.isLayerVisible(name)) return
      layer.isVisible = false
      // Remove the cesium layer from globe
      let cesiumLayer = this.cesiumLayers[name]
      if (this.isTerrainLayer(layer.cesium)) {
        this.viewer.terrainProvider = null
      } else if (cesiumLayer instanceof Cesium.ImageryLayer) {
        this.viewer.scene.imageryLayers.remove(cesiumLayer, false)
      } else {
        this.viewer.dataSources.remove(cesiumLayer, false)
      }
      this.$emit('layer-hidden', layer, cesiumLayer)
    },
    async addLayer (layer) {
      if (layer && !this.hasLayer(layer.name)) {
        layer.isVisible = false
        // Store the layer and make it reactive
        this.$set(this.layers, layer.name, layer)
        this.$emit('layer-added', layer)
        // Handle the visibility state
        if (_.get(layer, 'cesium.isVisible', false)) await this.showLayer(layer.name)
      }
      return layer
    },
    renameLayer (previousName, newName) {
      const layer = this.getLayerByName(previousName)
      const cesiumLayer = this.getCesiumLayerByName(previousName)
      if (!layer) return
      // Update underlying layer map if layer has been already shown
      if (cesiumLayer) {
        this.cesiumLayers[newName] = cesiumLayer
        delete this.cesiumLayers[previousName]
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
      delete this.cesiumLayers[name]
      this.$emit('layer-removed', layer)
    },
    zoomToBounds (bounds) {
      this.viewer.camera.flyTo({
        duration: 0,
        destination: Cesium.Rectangle.fromDegrees(bounds[0][1], bounds[0][0], bounds[1][1], bounds[1][0])
      })
    },
    zoomToLayer (name) {
      const layer = this.getCesiumLayerByName(name)
      if (!layer || !layer.entities) return

      this.viewer.flyTo(layer.entities, { duration: 0 })
    },
    center (longitude, latitude, altitude = 10000, heading = 0, pitch = -90, roll = 0) {
      const target = {
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude),
        orientation: {
          heading: Cesium.Math.toRadians(heading),
          pitch: Cesium.Math.toRadians(pitch),
          roll: Cesium.Math.toRadians(roll)
        }
      }
      if (this.viewer.clock.shouldAnimate) this.viewer.camera.flyTo(target)
      else this.viewer.camera.setView(target)
    },
    getCenter () {
      const center = this.viewer.camera.positionCartographic
      return {
        longitude: Cesium.Math.toDegrees(center.longitude),
        latitude: Cesium.Math.toDegrees(center.latitude),
        altitude: center.height
      }
    },
    getBounds () {
      const bounds = this.viewer.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid, this.viewBounds)
      const south = Cesium.Math.toDegrees(bounds.south)
      const west = Cesium.Math.toDegrees(bounds.west)
      const north = Cesium.Math.toDegrees(bounds.north)
      const east = Cesium.Math.toDegrees(bounds.east)
      return [ [south, west], [north, east] ]
    },
    setCursor (className) {
      this.viewer.container.classList.add(className)
    },
    unsetCursor (className) {
      this.viewer.container.classList.remove(className)
    },
    getLayerNameForEntity (entity) {
      let layerName
      _.forOwn(this.cesiumLayers, (value, key) => {
        if (!layerName && value.entities) {
          if (value.entities.contains(entity)) layerName = key
        }
      })
      return layerName
    },
    getNbChildrenForEntity (entity) {
      if (entity._children) return entity._children.length
      else return 0
    },
    getChildForEntity (entity, index) {
      if (this.getNbChildrenForEntity(entity) > 0) return entity._children[index || 0]
    },
    getPositionForEntity (entity) {
      let position = entity.position
      if (!position) {
        if (entity.polygon) {
          position = Cesium.BoundingSphere.fromPoints(entity.polygon.positions.getValue()).center
        } else if (entity.polyline) {
          position = Cesium.BoundingSphere.fromPoints(entity.polyline.positions.getValue()).center
        }
        Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(position, position)
      }
      return position
    },
    getDefaultPickHandler (event) {
      let emittedEvent = {}
      let options
      let pickedPosition = this.viewer.camera.pickEllipsoid(event.endPosition || event.position, this.viewer.scene.globe.ellipsoid)
      if (pickedPosition) {
        pickedPosition = Cesium.Cartographic.fromCartesian(pickedPosition)
        const longitude = Cesium.Math.toDegrees(pickedPosition.longitude)
        const latitude = Cesium.Math.toDegrees(pickedPosition.latitude)
        // This ensure we can use similar handlers than for Leaflet
        emittedEvent.latlng = [latitude, longitude]
        emittedEvent.latlng.lng = longitude
        emittedEvent.latlng.lat = latitude
      }
      const pickedObject = this.viewer.scene.pick(event.endPosition || event.position)
      if (pickedObject) {
        emittedEvent.target = pickedObject.id || pickedObject.primitive.id
        if (emittedEvent.target instanceof Cesium.Entity) {
          let layer = this.getLayerNameForEntity(emittedEvent.target)
          if (layer) layer = this.getCesiumLayerByName(layer)
          if (layer) options = layer.processedOptions
        }
      }
      // Mimic Leaflet events
      this.$emit(event.originalEvent.name, options, emittedEvent)
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('globe'))
  },
  created () {
    this.cesiumLayers = {}
    this.cesiumFactory = []
  },
  beforeDestroy () {
    Object.keys(this.layers).forEach((layer) => this.removeLayer(layer))
  },
  destroyed () {
    this.viewer.destroy()
  }
}

export default baseGlobeMixin
