import Cesium from 'cesium/Source/Cesium.js'
import { Store } from 'kCore/client'

let baseLayersMixin = {
  data () {
    return {
    }
  },
  methods: {
    setupBaseLayers () {
      this.imageryProviderViewModels = []
      this.$store.get('config.globe.baseLayers').forEach(baseLayer => {
        // Transform from string to actual object
        if (typeof baseLayer.iconUrl === 'string') {
          baseLayer.iconUrl = Cesium.buildModuleUrl(baseLayer.iconUrl)
        }
        let options = Object.assign({}, baseLayer, {
          creationFunction () { return new Cesium[baseLayer.type + 'ImageryProvider'](baseLayer) }
        })
        this.imageryProviderViewModels.push(new Cesium.ProviderViewModel(options))
      })
      console.log(this.imageryProviderViewModels)
    },
    setupTerrainLayers () {
      this.terrainProviderViewModels = []
      this.$store.get('config.globe.terrainLayers').forEach(terrainLayer => {
        // Transform from string to actual object
        if (typeof terrainLayer.iconUrl === 'string') {
          terrainLayer.iconUrl = Cesium.buildModuleUrl(terrainLayer.iconUrl)
        }
        let options = Object.assign({}, terrainLayer, {
          creationFunction () { return new Cesium[terrainLayer.type + 'TerrainProvider'](terrainLayer) }
        })
        this.terrainProviderViewModels.push(new Cesium.ProviderViewModel(options))
      })
      console.log(this.terrainProviderViewModels)
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.setupBaseLayers()
    this.setupTerrainLayers()
    if (this.imageryProviderViewModels.length > 0) {
      if (this.options.baseLayerPicker) {
        this.options.selectedImageryProviderViewModel = this.imageryProviderViewModels[0]
        this.options.imageryProviderViewModels = this.imageryProviderViewModels
      } else {
        this.options.imageryProvider = this.imageryProviderViewModels[0].creationCommand()
      }
    }
    if (this.terrainProviderViewModels.length > 0) {
      if (this.options.baseLayerPicker) {
        this.options.selectedTerrainProviderViewModel = this.terrainProviderViewModels[0]
        this.options.terrainProviderViewModels = this.terrainProviderViewModels
      } else {
        this.options.terrainProvider = this.terrainProviderViewModels[0].creationCommand()
      }
    }
  },
  mounted () {
  }
}

Store.set('mixins.globe.baseLayers', baseLayersMixin)

export default baseLayersMixin
