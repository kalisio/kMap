import Cesium from 'cesium/Source/Cesium.js'

let overlayLayersMixin = {
  data () {
    return {
    }
  },
  methods: {
    setupOverlayLayers () {
      this.$config('globe.overlayLayers').forEach(overlayLayer => {
        this.overlaysLayers.push(this.createLayer(overlayLayer))
      })
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.overlaysLayers = []
  },
  mounted () {
    this.setupOverlayLayers()
  }
}

export default overlayLayersMixin
