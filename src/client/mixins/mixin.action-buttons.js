import _ from 'lodash'
import moment from 'moment'

export default {
  data () {
    return {
      featureActions: [{ icon: 'whatshot' }, { icon: 'whatshot' }, { icon: 'whatshot' }, { icon: 'whatshot' }],
      radialMenuPosition: { x: -100, y: -100 }
    }
  },
  computed: {
    radialFabStyle () {
      return `zIndex: 1000; position: absolute;
        left: ${this.radialMenuPosition.x - 25}px; top: ${this.radialMenuPosition.y - 25}px;
        background-color: #FC6E44;`
    },
    radialFabItemStyle () {
      return `background-color: #FC6E44;`
    }
  },
  methods: {
    updateRadialMenuPosition (event) {
      if (event.containerPoint) this.radialMenuPosition = event.containerPoint
    },
    async onFeatureActionButtons (options, event) {
      const feature = _.get(event, 'target.feature')
      if (!feature) return
      this.updateRadialMenuPosition(event)
      this.$refs.radialMenu.open()
    },
    onFeatureActionSelected (action) {
      console.log(action)
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-radial-fab'] = this.$load('menu/KRadialFab')
    this.$options.components['k-radial-fab-item'] = this.$load('menu/KRadialFabItem')
  },
  mounted () {
    this.$on('click', this.onFeatureActionButtons)
    //this.$on('move', this.updateRadialMenuPosition)
  },
  beforeDestroy () {
    this.$off('click', this.onFeatureActionButtons)
    //this.$off('move', this.updateRadialMenuPosition)
  }
}
