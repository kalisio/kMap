<template>
  <q-list>
    <template v-for="category in categories">
      <q-collapsible :key="category.name" :icon="category.icon" :label="$t(category.label)">
        <k-layers-selector 
          :layers="layers"
          :layerHandlers="layerHandlers"
          :category="category.name" 
          :exclusive="category.exclusive" />
      </q-collapsible>
    </template>
  </q-list>
</template>

<script>
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
  created () {
    this.$options.components['k-layers-selector'] = this.$load('KLayersSelector')
  }
}
</script>

