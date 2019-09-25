<template>
  <q-card v-show="properties">
    <q-scroll-area style="height: 40vh">
      <q-btn class="float-right" flat round small color="primary" @click="onClose">
        <q-icon name="close" />
        <q-tooltip>{{$t('CLOSE')}}</q-tooltip>
      </q-btn>
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
      if (!options || !options.schema) return
      this.schema = options.schema.content
      let feature = _.get(event, 'target.feature')
      if (!feature || _.isEmpty(feature.properties)) return
      this.properties = feature.properties
    },
    onClose () {
      this.properties = null
      this.schema = null
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

