import L from 'leaflet'
import 'leaflet-timedimension/dist/leaflet.timedimension.src.js'
import 'leaflet-timedimension/dist/leaflet.timedimension.control.css'

let timedimensionMixin = {
  mounted () {
    let timeDimension = L.timeDimension({})
    let timeDimensionControl = L.control.timeDimension({
      timeDimension,
      position: 'bottomright',
      speedSlider: false,
      playButton: false,
      playerOptions: { minBufferReady: -1 } // This avoid preloading of next times
    })
    this.controls.push(timeDimensionControl)
    // Make time dimension available
    this.$on('map-ready', _ => {
      this.map.timeDimension = timeDimension
      timeDimension.on('timeload', data => this.setCurrentTime(data.time))
    })
  }
}

export default timedimensionMixin
