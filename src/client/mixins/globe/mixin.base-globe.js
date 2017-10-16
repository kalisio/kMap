import { Store } from 'kCore/client'
import Cesium from 'cesium/Source/Cesium.js'
import 'cesium/Source/Widgets/widgets.css'
import BuildModuleUrl from 'cesium/Source/Core/buildModuleUrl'
// Cesium has its own dynamic module loader requiring to be configured
// Cesium files need to be also added as static assets of the applciation
BuildModuleUrl.setBaseUrl('./statics/Cesium/')

let baseGlobeMixin = {
  methods: {
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$store.get('config.globe.options'))
  },
  created () {
  },
  mounted () {
    // Initialize the globe now the DOM is ready
    this.viewer = new Cesium.Viewer('globe', this.options)
    this.$on('globeReady', _ => {
      // TODO
    })
  },
  beforeDestroy () {
    this.viewer.destroy()
  }
}

Store.set('mixins.globe.baseGlobe', baseGlobeMixin)

export default baseGlobeMixin
