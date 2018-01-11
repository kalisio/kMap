import L from 'leaflet'
import 'leaflet-measure/dist/leaflet-measure.js'
import 'leaflet-measure/dist/leaflet-measure.css'

let measureMixin = {
  mounted () {
    let measureControl = new L.Control.Measure({ position: 'topright' })
    this.controls.push(measureControl)
  }
}

export default measureMixin
