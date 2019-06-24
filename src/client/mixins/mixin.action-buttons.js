import _ from 'lodash'
import moment from 'moment'

export default {
  data () {
    return {
      featureActions: [],
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
    clearFeatureActions () {
      this.featureActions = []
    },
    // This method should be overriden in activities
    refreshFeatureActions (feature, layer) {
      this.clearFeatureActions()
    },
    getFeatureAction (name) {
      return this.featureActions.find({ name })
    },
    selectFeatureForAction (feature, layer) {
      this.selectedLayerForAction = layer
      this.selectedFeatureForAction = feature
    },
    unselectFeatureForAction () {
      this.selectedLayerForAction = null
      this.selectedFeatureForAction = null
    },
    updateRadialMenuPosition (event) {
      if (event.containerPoint) this.radialMenuPosition = event.containerPoint
    },
    async onFeatureActionButtons (layer, event) {
      const feature = _.get(event, 'target.feature')
      if (!feature) return
      this.refreshFeatureActions(feature, layer)
      // Nothing allowed on this feature or close menu on the same one
      if ((this.selectedFeatureForAction === feature) || (this.featureActions.length === 0)) {
        this.$refs.radialMenu.close() // Closing should be bound to unselect
      } else {
        this.selectFeatureForAction(feature, layer)
        this.updateRadialMenuPosition(event)
        this.$refs.radialMenu.open()
      }
    },
    onFeatureActionClicked (action) {
      if (action.handler) action.handler(this.selectedFeatureForAction, this.selectedLayerForAction)
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
