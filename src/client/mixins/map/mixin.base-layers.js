import _ from 'lodash'
import L from 'leaflet'
import 'leaflet-basemaps/L.Control.Basemaps.js'
import 'leaflet-basemaps/L.Control.Basemaps.css'

let baseLayersMixin = {
  data () {
    return {
    }
  },
  methods: {
    setupBaseLayers () {
      this.$config('map.baseLayers').forEach(baseLayer => {
        // Transform from string to actual objects when required in some of the layer options
        ['crs', 'rendererFactory'].forEach(option => {
          // Find the right argument holding the option
          let options = _.find(baseLayer.arguments, argument => typeof _.get(argument, option) === 'string')
          if (options) {
            // Jump from string to object, eg { crs: 'CRS.EPSGXXX' } will become { crs: L.CRS.EPSGXXX }
            _.set(options, option, _.get(L, _.get(options, option)))
          }
        })
        this.baseLayers.push(_.get(L, baseLayer.type)(...baseLayer.arguments))
      })
    }
  },
  created () {
    // This is the right place to declare private members because Vue has already processed observed data
    this.baseLayers = []
  },
  mounted () {
    this.setupBaseLayers()
    let baseLayersControl = L.control.basemaps({
      basemaps: this.baseLayers,
      position: 'bottomleft',
      tileX: 0,  // tile X coordinate
      tileY: 0,  // tile Y coordinate
      tileZ: 1   // tile zoom level
    })
    this.controls.push(baseLayersControl)
  }
}

export default baseLayersMixin
