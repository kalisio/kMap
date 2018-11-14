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
      // Because we update objects in place
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
      let provider
      if (this.isTerrainLayer(options)) {
        if (options.url || (options.type === 'Ellipsoid')) provider = options.type + 'TerrainProvider'
        // If no url given will use default terrain creation function createWorldTerrain()
        else provider = 'WorldTerrain'
      } else {
        provider = options.type + 'ImageryProvider'
      }
      // Handle specific case of built-in creation functions
      const createFunction = 'create' + provider
      provider = (Cesium[createFunction] ? Cesium[createFunction](options) : new Cesium[provider](options))
      // Terrain is directly managed using a provider
      return (this.isTerrainLayer(options) ? provider : new Cesium.ImageryLayer(provider))
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
        layer = await constructor(processedOptions.cesium)
        if (layer) break
      }
      // Use default Cesium layer constructor if none found
      return (layer ? layer : this.createCesiumLayer(processedOptions.cesium))
    },
    hasLayer (name) {
      return _.has(this.layers, name)
    },
    getLayerByName (name) {
      if (!this.hasLayer(name)) return null
      return this.layers[name]
    },
    async showLayer (name) {
      // Retieve the layer
      let layer = this.getLayerByName(name)
      if (!layer) return
      // Check the visibility state
      if (layer.isVisible === true) return
      layer.isVisible = true
      // Create the Cesium layer
      let cesiumLayer = await this.createLayer(layer)
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
      if (layer.isVisible === false) return
      layer.isVisible = false
      // Delete the cesium layer
      let cesiumLayer = this.cesiumLayers[name]
      if (this.isTerrainLayer(layer.cesium)) {
        this.viewer.terrainProvider = null
      } else if (cesiumLayer instanceof Cesium.ImageryLayer) {
        this.viewer.scene.imageryLayers.remove(cesiumLayer)
      } else {
        this.viewer.dataSources.remove(cesiumLayer)
      }
      delete this.cesiumLayers[name]
    },
    addLayer (layer) {
      if (layer && !this.hasLayer(layer.name)) {
        // Store the layer
        this.layers[layer.name] = layer
        // Handle the visibility state
        layer['isVisible'] = false
        if (_.get(layer, 'cesium.isVisible', false)) this.showLayer(layer.name)
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
