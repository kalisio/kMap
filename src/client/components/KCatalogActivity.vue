<template>
  <div>
    <div ref="map" class="k-catalog-map">
      <q-resize-observable @resize="onMapResized" />
    </div>
    <q-btn 
      id="map-panel-toggle"
      color="secondary"
      class="fixed"
      style="right: 18px; top: 72px"
      small
      round 
      icon="layers"
      @click="layout.toggleRight()" />
  </div>
</template>

<script>
import * as mapMixins from '../mixins/map'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'
import { QResizeObservable, QBtn } from 'quasar'

export default {
  name: 'k-catalog-activity',
  mixins: [
    kCoreMixins.baseActivity,
    kCoreMixins.refsResolver(['map']),
    mapMixins.baseMap
  ],
  inject: ['layout'],
  components: {
    QResizeObservable,
    QBtn
  },
  props: {
    contextId: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      layerCategories: {}
    }
  },
  methods: {
    router () {
      return {
        onApply: { name: 'catalog-activity', params: { contextId: this.contextId } },
        onDismiss: { name: 'catalog-activity', params: { contextId: this.contextId } }
      }
    },
    refreshActivity () {
      this.clearActivity()
      // Title
      this.setTitle(this.$store.get('context.name'))
      // Setup the right pane
      this.layerCategories = this.$config('mapPanel.categories')
      console.log(this.layerCategories)
      this.setRightPanelContent('Panel', this.$data)
    },
    onMapResized () {
      if (this.observe) this.refreshMap()
    },
    async refreshBaseLayer () {
      this.layers = {}
      const catalogService = this.$api.getService('catalog')
      // Get first visible base layer
      let response = await catalogService.find({ query: { type: 'BaseLayer', 'leaflet.isVisible': true } })
      if (response.data.length > 0) this.addLayer(response.data[0])
    }
  },
  created () {
    this.observe = true
  },
  async mounted () {
    await this.loadRefs()
    this.setupMap(this.$refs.map, this.$config('map.viewer'))
    this.refreshBaseLayer()
  },
  beforeDestroy () {
    this.observe = false
  }
}
</script>

<style>
.k-catalog-map {
  position: absolute;
  left: 0rem;
  right: 0rem;
  top: 0rem;
  bottom: 0rem;
  font-weight: normal;
  z-index: 0;
}
</style>