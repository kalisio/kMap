<template>
  <q-list>
    <template v-for="category in categories">
      <q-collapsible :key="category.name" :icon="category.icon" :label="category.label">
        <div class="row">
          <template v-for="layer in getLayersOfClass(category.name)">
            <q-btn :id ="layer.name" :key="layer.name" flat>
              <q-icon :name="layer.icon" />
            </q-btn>
          </template>
        </div>
      </q-collapsible>
    </template>
  </q-list>
</template>

<script>
import _ from 'lodash'
import { QList, QCollapsible, QBtn } from 'quasar'

export default {
  name: 'k-map-panel',
  components: {
    QList,
    QCollapsible
  },
  props: {
    layers: {
      type: Array,
      default: () => []
    },
    categories: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    getLayersOfClass (category) {
      return _.find(this.layers, { category: category })
    }
  }
}
</script>

