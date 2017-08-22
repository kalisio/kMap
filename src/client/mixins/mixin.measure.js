import L from 'leaflet'
import 'leaflet-measure/dist/leaflet-measure.js'
import 'leaflet-measure/dist/leaflet-measure.css'
import { Store } from 'kCore/client'

let measureMixin = {
  mounted () {
    let measureControl = new L.Control.Measure({ position: 'topright' })
    this.controls.push(measureControl)
  }
}

Store.set('mixins.map.measure', measureMixin)

export default measureMixin
