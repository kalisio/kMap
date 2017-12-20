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
      this.$config('globe.baseLayers').forEach(baseLayer => {
        // Transform from string to actual object
        if (typeof baseLayer.iconUrl === 'string') {
          baseLayer.iconUrl = Cesium.buildModuleUrl(baseLayer.iconUrl)
        }
        let options = Object.assign({}, baseLayer, {
          creationFunction () { return new Cesium[baseLayer.type + 'ImageryProvider'](baseLayer) }
        })
        this.imageryProviderViewModels.push(new Cesium.ProviderViewModel(options))
      })
      if (this.imageryProviderViewModels.length > 0) {
        if (this.options.viewer.baseLayerPicker) {
          this.options.viewer.selectedImageryProviderViewModel = this.imageryProviderViewModels[0]
          this.options.viewer.imageryProviderViewModels = this.imageryProviderViewModels
        } else {
          this.options.viewer.imageryProvider = this.imageryProviderViewModels[0].creationCommand()
        }
      }
    },
    setupTerrainLayers () {
      this.terrainProviderViewModels = []
      this.$config('globe.terrainLayers').forEach(terrainLayer => {
        // Transform from string to actual object
        if (typeof terrainLayer.iconUrl === 'string') {
          terrainLayer.iconUrl = Cesium.buildModuleUrl(terrainLayer.iconUrl)
        }
        let options = Object.assign({}, terrainLayer, {
          creationFunction () { return new Cesium[terrainLayer.type + 'TerrainProvider'](terrainLayer) }
        })
        this.terrainProviderViewModels.push(new Cesium.ProviderViewModel(options))
      })
      if (this.terrainProviderViewModels.length > 0) {
        if (this.options.viewer.baseLayerPicker) {
          this.options.viewer.selectedTerrainProviderViewModel = this.terrainProviderViewModels[0]
          this.options.viewer.terrainProviderViewModels = this.terrainProviderViewModels
        } else {
          this.options.viewer.terrainProvider = this.terrainProviderViewModels[0].creationCommand()
        }
      }
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.setupBaseLayers()
    this.setupTerrainLayers()
  },
  mounted () {
  }
}

Store.set('mixins.globe.baseLayers', baseLayersMixin)

export default baseLayersMixin
