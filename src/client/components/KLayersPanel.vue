<template>
  <q-list>
    <template v-for="type in types">
      <q-collapsible :key="type.name" :icon="type.icon" :label="$t(type.label)">
        <k-layers-selector :layers="getLayersOfType(type.name)" :exclusive="type.exclusive" />
      </q-collapsible>
    </template>
  </q-list>
</template>

<script>
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
    types: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    getLayersOfType (type) {
      return _.filter(this.layers, { type: type })
    }
  },
  created () {
    this.$options.components['k-layers-selector'] = this.$load('KLayersSelector')
  }
}
</script>

