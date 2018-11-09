<template>
  <q-list>
    <template v-for="type in types">
      <q-collapsible :key="type.name" :icon="type.icon" :label="type.label">
        <div class="row">
          <template v-for="layer in getLayersOfType(type.name)">
            <q-btn :id ="layer.name" :key="layer.name" flat>
              <q-icon name="map" />
            </q-btn>
          </template>
        </div>
      </q-collapsible>
    </template>
  </q-list>
</template>

<script>
import _ from 'lodash'
import { QList, QCollapsible, QBtn, QIcon } from 'quasar'

export default {
  name: 'k-map-panel',
  components: {
    QList,
    QCollapsible,
    QBtn,
    QIcon
  },
  props: {
    layers: {
      type: Array,
      default: () => []
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
  }
}
</script>

