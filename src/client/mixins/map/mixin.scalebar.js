import L from 'leaflet'

let scalebarMixin = {
  mounted () {
    let scalebarControl = L.control.scale()
    this.controls.push(scalebarControl)
  }
}

export default scalebarMixin
