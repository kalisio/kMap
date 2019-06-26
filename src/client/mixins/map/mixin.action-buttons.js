import _ from 'lodash'
import moment from 'moment'

export default {
  data () {
    return {
      featureActions: [],
      radialFabPosition: { x: -100, y: -100 }
    }
  },
  computed: {
    radialFabStyle () {
      return `zIndex: 1000; position: absolute;
        left: ${this.radialFabPosition.x - 25}px; top: ${this.radialFabPosition.y - 25}px;`
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
    getFeatureForAction () {
      return this.selectionForAction.feature
    },
    selectFeatureForAction (feature, layer, leafletLayer) {
      this.selectionForAction = { feature, layer, leafletLayer }
    },
    unselectFeatureForAction () {
      this.selectionForAction = {}
    },
    updateRadialMenuPosition (layer, event) {
      if (event.containerPoint) this.radialFabPosition = event.containerPoint
      else if (this.selectionForAction.leafletLayer) {
        this.radialFabPosition = this.map.latLngToContainerPoint(this.selectionForAction.leafletLayer.getLatLng())
      }
    },
    async onFeatureActionButtons (layer, event) {
      const leafletLayer = event && event.target
      if (!leafletLayer) return
      let feature = _.get(leafletLayer, 'feature')
      if (!feature) return
      this.refreshFeatureActions(feature, layer)
      // Nothing allowed on this feature or close menu on the same one
      if ((this.getFeatureForAction() === feature) || (this.featureActions.length === 0)) {
        this.$refs.radialFab.close() // Closing should be bound to unselect
      } else {
        this.selectFeatureForAction(feature, layer, leafletLayer)
        this.updateRadialMenuPosition(layer, event)
        this.$refs.radialFab.open()
      }
    },
    onFeatureActionClicked (action) {
      const { feature, layer, leafletLayer } = this.selectionForAction
      // If a handler is given call it
      if (action.handler) action.handler.call(this, feature, layer, leafletLayer)
      // If a route is given activate it
      else if (action.route) this.$router.push(action.route)
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-radial-fab'] = this.$load('menu/KRadialFab')
    this.$options.components['k-radial-fab-item'] = this.$load('menu/KRadialFabItem')
    this.selectionForAction = {}
  },
  mounted () {
    this.$on('contextmenu', this.onFeatureActionButtons)
    this.$on('move', this.updateRadialMenuPosition)
  },
  beforeDestroy () {
    this.$off('contextmenu', this.onFeatureActionButtons)
    this.$off('move', this.updateRadialMenuPosition)
  }
}
