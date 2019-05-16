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
import config from 'config'
import { mixins as kMapMixins } from '..'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'
import { QResizeObservable, QBtn } from 'quasar'

export default {
  name: 'k-catalog-activity',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    kCoreMixins.baseActivity,
    kMapMixins.geolocation,
    kMapMixins.featureService,
    kMapMixins.weacast,
    kMapMixins.time,
    kMapMixins.activity,
    kMapMixins.legend,
    kMapMixins.locationIndicator,
    kMapMixins.map.baseMap,
    kMapMixins.map.geojsonLayers,
    kMapMixins.map.forecastLayers,
    kMapMixins.map.fileLayers,
    kMapMixins.map.editLayers,
    kMapMixins.map.style,
    kMapMixins.map.tooltip,
    kMapMixins.map.popup
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
    async refreshActivity () {
      this.clearActivity()
      // Title
      this.setTitle(this.$store.get('context.name'))
      // Setup the right pane
      this.setRightPanelContent('KCatalogPanel', this.$data)
      this.registerActivityActions()
      // Ensure DOM ref is here as well
      await this.loadRefs()
      this.setupMap(this.$refs.map, this.$config('map.viewer'))
      // Wait until viewer is ready
      await this.initializeView()
    },
    async getCatalogLayers () {
      let layers = []
      // We get layers coming from any global catalog first
      const catalogService = this.$api.getService('catalog', '')
      if (catalogService) {
        let response = await catalogService.find()
        layers = layers.concat(response.data)
      }
      // Then merge layers coming from any contextual catalog
      const contextualCatalogService = this.$api.getService('catalog')
      if (contextualCatalogService && (contextualCatalogService !== catalogService)) {
        let response = await contextualCatalogService.find()
        layers = layers.concat(response.data)
      }
      return layers
    },
    getViewKey () {
      return config.appName.toLowerCase() + '-catalog-view'
    },
    onMapResized () {
      if (this.observe) this.refreshMap()
    }
  },
  created () {
    this.observe = true
  },
  async mounted () {
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