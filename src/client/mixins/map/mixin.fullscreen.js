import L from 'leaflet'
import 'leaflet-fullscreen'
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css'
import { Store } from 'kCore/client'

let fullscreenMixin = {
  mounted () {
    let fullscreenControl = new L.Control.Fullscreen()
    this.controls.push(fullscreenControl)
  }
}

Store.set('mixins.map.fullscreen', fullscreenMixin)

export default fullscreenMixin
