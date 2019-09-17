<template>
  <q-card v-show="properties">
    <q-scroll-area style="height: 40vh">
      <div class="row items-center full-height">
        <k-view class="q-pa-xs" ref="view" :schema="schema" @view-ready="onViewReady" />
      </div>
    </q-scroll-area>
  </q-card>
</template>

<script>
import _ from 'lodash'
import { QScrollArea } from 'quasar'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'

export default {
  name: 'k-feature-info-box',
  components: {
    QScrollArea
  },
  mixins: [
    kCoreMixins.refsResolver(['view'])
  ],
  inject: ['kActivity'],
  data () {
    return {
      schema: null,
      properties: null
    }
  },
  methods: {
    async onFeatureClicked (options, event) {
      this.properties = null
      this.schema = await this.kActivity.loadLayerSchema(options)
      if (!options.schema) return
      this.schema = JSON.parse(this.schema)
      let feature = _.get(event, 'target.feature')
      if (!feature || _.isEmpty(feature.properties)) return
      this.properties = feature.properties
    },
    onViewReady () {
      this.$refs.view.fill(this.properties)
    } 
  },
  created () {
    // laod the required components
    this.$options.components['k-view'] = this.$load('form/KView')
    // Listen to the click feature event
    this.kActivity.$on('click', this.onFeatureClicked)
  },
  beforeDestroy() {
     this.kActivity.$on('click', this.onFeatureClicked)
  }
}
</script>

