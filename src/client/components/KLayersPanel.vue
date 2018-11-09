<template>
  <q-list>
    <template v-for="type in types">
      <q-collapsible :key="type.name" :icon="type.icon" :label="type.label">
        <div class="row">
          <template v-for="layer in getLayersOfType(type.name)">
            <q-btn :id ="layer.name" :key="layer.name" flat round>
              <img src="https://s3.eu-central-1.amazonaws.com/kalisioscope/collections/sjjb/accommodation_chalet2.n.24.png" />
              <q-tooltip>
                {{layer.name}}
              </q-tooltip>
            </q-btn>
          </template>
        </div>
      </q-collapsible>
    </template>
  </q-list>
</template>

<script>
import _ from 'lodash'
import { QList, QCollapsible, QBtn, QIcon, QTooltip } from 'quasar'

export default {
  name: 'k-layers-control',
  components: {
    QList,
    QCollapsible,
    QBtn,
    QIcon,
    QTooltip
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

