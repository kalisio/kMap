import lodash from 'lodash'
import L from 'leaflet'
import 'leaflet-basemaps/L.Control.Basemaps.js'
import 'leaflet-basemaps/L.Control.Basemaps.css'
import { Store } from 'kCore/client'

let baseLayersMixin = {
  data () {
    return {
    }
  },
  methods: {
    setupBaseLayers () {
      this.$store.get('config.map.baseLayers').forEach(baseLayer => {
        // Transform from string to actual object
        let argument = lodash.find(baseLayer.arguments, argument => typeof argument.crs === 'string')
        if (argument) {
          argument.crs = L.CRS[argument.crs]
        }
        this.baseLayers.push(lodash.get(L, baseLayer.type)(...baseLayer.arguments))
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

Store.set('mixins.map.baseLayers', baseLayersMixin)

export default baseLayersMixin
