import L from 'leaflet'
import { Store } from 'kCore/client'

let scalebarMixin = {
  mounted () {
    let scalebarControl = L.control.scale()
    this.controls.push(scalebarControl)
  }
}

Store.set('mixins.map.scalebar', scalebarMixin)

export default scalebarMixin
