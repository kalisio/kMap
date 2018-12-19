import _ from 'lodash'
import Cesium from 'cesium/Source/Cesium.js'
import 'cesium/Source/Widgets/widgets.css'
import BuildModuleUrl from 'cesium/Source/Core/buildModuleUrl'
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
    setupGlobe () {
      // Initialize the globe
      Object.assign(this.options.viewer, {
        imageryProviderViewModels: [],
        terrainProviderViewModels: []
      })
      this.viewer = new Cesium.Viewer('globe', this.options.viewer)
      // Cesium always create a default provider
      this.viewer.scene.imageryLayers.removeAll()
      this.$emit('globe-ready')
    },
    processCesiumLayerOptions (options) {
      // Because we update objects in place and don't want cesium internal objects to be reactive
      let processedOptions = _.cloneDeep(options)
      // Transform from string to actual object
      processedOptions.cesium.iconUrl = Cesium.buildModuleUrl(processedOptions.iconUrl)
      // Copy generic options
      processedOptions.cesium.name = processedOptions.name
      processedOptions.cesium.tooltip = processedOptions.name
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
      return (layer || this.createCesiumLayer(processedOptions))
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
      if (!this.hasLayer(name)) return null
      return this.layers[name]
    },
    getCesiumLayerByName (name) {
      if (!this.hasLayer(name)) return null
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
    zoomToLayer (name) {
      const layer = this.getCesiumLayerByName(name)
      if (!layer || !layer.entities) return
      
      this.viewer.flyTo(layer.entities, { duration: 0 })
    },
    center (longitude, latitude, altitude = 0, heading = 0, pitch = -90, roll = 0) {
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
    this.viewer.destroy()
  }
}

export default baseGlobeMixin
