<template>
  <k-radial-fab ref="radialFab" 
      :style="radialFabStyle"
      :start-angle="0"
      :end-angle="-180"
      :radius="80"
      @close="unselectFeatureForAction">
      <!--q-btn slot="closed-menu-container"
        round color="secondary" icon="keyboard_arrow_up" /-->
      <q-btn slot="open-menu-container"
        round color="secondary" icon="close" />
      <k-radial-fab-item
        v-for="(action, index) in featureActions" 
        :key="index">
        <q-btn round color="secondary" :icon="action.icon" @click="onFeatureActionClicked(action)" />
      </k-radial-fab-item>
    </k-radial-fab>
</template>

<script>
import _ from 'lodash'

export default {
  inject: ['kActivity'],
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
      const feature = _.get(leafletLayer, 'feature')
      if (!feature) return
      this.featureActions = this.kActivity.getFeatureActions(feature, layer)
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
    this.kActivity.$on('contextmenu', this.onFeatureActionButtons)
    this.kActivity.$on('move', this.updateRadialMenuPosition)
  },
  beforeDestroy () {
    this.kActivity.$off('contextmenu', this.onFeatureActionButtons)
    this.kActivity.$off('move', this.updateRadialMenuPosition)
  }
}
</script>
