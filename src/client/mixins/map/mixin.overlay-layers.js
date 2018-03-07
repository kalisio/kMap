import _ from 'lodash'
import L from 'leaflet'

let overlayLayersMixin = {
  data () {
    return {
    }
  },
  methods: {
    setupOverlayLayers () {
      this.$config('map.overlayLayers').forEach(overlayLayer => {
        this.overlaysLayers[overlayLayer.name] = this.createLayer(overlayLayer)
      })
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.overlaysLayers = {}
  },
  mounted () {
    this.setupOverlayLayers()
    this.overlayLayersControl = L.control.layers({}, this.overlaysLayers)
    this.controls.push(this.overlayLayersControl)
  }
}

export default overlayLayersMixin
