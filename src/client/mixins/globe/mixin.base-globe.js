import Cesium from 'cesium/Source/Cesium.js'
import 'cesium/Source/Widgets/widgets.css'
import BuildModuleUrl from 'cesium/Source/Core/buildModuleUrl'
// Cesium has its own dynamic module loader requiring to be configured
// Cesium files need to be also added as static assets of the applciation
BuildModuleUrl.setBaseUrl('./statics/Cesium/')

let baseGlobeMixin = {
  methods: {
    refreshGlobe () {
    },
    setupGlobe () {
      // Initialize the globe
      this.viewer = new Cesium.Viewer('globe', this.options.viewer)
      this.$emit('globe-ready')
      this.setupControls()
    },
    setupControls () {
      this.$emit('controls-ready')
    }
  },
  beforeCreate () {
    this.options = Object.assign({}, this.$config('globe'))
  },
  created () {
  },
  mounted () {
  },
  beforeDestroy () {
    this.viewer.destroy()
  }
}

export default baseGlobeMixin
