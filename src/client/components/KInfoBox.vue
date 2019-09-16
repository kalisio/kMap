<template>
  <q-card>
    <q-scroll-area style="height: 40vh">
      <div class="row items-center full-height">
        <k-view class="q-pa-xs" ref="view" :schema="schema" @view-ready="onViewReady" />
      </div>
    </q-scroll-area>
  </q-card>
</template>

<script>
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'

export default {
  name: 'k-info-box',
  mixins: [
    kCoreMixins.refsResolver(['view'])
  ],
  inject: ['kActivity'],
  data () {
    return {
      schema: null
    }
  },
  methods: {
    async onFeatureClicked (options, event) {
      this.properties = null
      let feature = _.get(event, 'target.feature')
      if (!feature) {
        if(this.engine !== 'cesium') return
        const entity = event.target
        if (!entity || !entity.properties) return
        feature = { properties: entity.properties.getValue(0) }
      }
      this.properties = feature.properties
      const schemaId = _.get(options, 'schema._id')
      if (!schemaId) return
      const data = await this.$api.getService('storage', this.kActivity.contextId).get(schemaId)
      if (!data.uri) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      const typeAndData = data.uri.split(',')
      if (typeAndData.length <= 1) throw Error(this.$t('errors.CANNOT_PROCESS_SCHEMA_DATA'))
      // We get data as a data URL
      this.schema = JSON.parse(atob(typeAndData[1]))
    },
    onViewReady () {
      console.log('view ready')
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

