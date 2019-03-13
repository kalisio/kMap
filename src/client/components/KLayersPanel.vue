<template>
  <q-list>
    <slot name="panel-header"/>
    <template v-for="category in categories">
      <q-collapsible
        v-if="layersByCategory[category.name].length > 0"
        :key="category.name"
        :icon="category.icon"
        :label="$t(category.label)">
        <k-layers-selector
          :layers="layersByCategory[category.name]"
          :layerHandlers="layerHandlers"
          :options="category.options || {}" />
      </q-collapsible>
    </template>
    <slot name="panel-footer"/>
  </q-list>
</template>

<script>
import sift from 'sift'
import _ from 'lodash'
import { QList, QCollapsible } from 'quasar'

export default {
  name: 'k-layers-panel',
  components: {
    QList,
    QCollapsible
  },
  props: {
    layers: {
      type: Object,
      default: () => {}
    },
    layerHandlers: {
      type: Object,
      default: () => {}
    },
    categories: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    layersByCategory () {
      const layers = _.values(this.layers)
      let layersByCategory = {}
      this.categories.forEach(category => {
        layersByCategory[category.name] = sift(_.get(category, 'options.filter', {}), layers)
      })
      return layersByCategory
    }
  },
  created () {
    this.$options.components['k-layers-selector'] = this.$load('KLayersSelector')
  }
}
</script>

