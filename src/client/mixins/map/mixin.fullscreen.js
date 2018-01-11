import L from 'leaflet'
import 'leaflet-fullscreen'
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css'

let fullscreenMixin = {
  mounted () {
    let fullscreenControl = new L.Control.Fullscreen()
    this.controls.push(fullscreenControl)
  }
}

export default fullscreenMixin
