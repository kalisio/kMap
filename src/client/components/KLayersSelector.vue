<template>
  <div class="row justify-around">
    <template v-for="layer in selection">
      <q-btn 
        :id ="layer.name" 
        :key="layer.name" 
        round 
        :flat="!layer.isVisible" 
        :outline="layer.isVisible" 
        @click="onLayerClicked(layer, selection)">
        <img :src="layer.iconUrl" width="32" height="32" />
        <q-tooltip>
          {{layer.name}}
        </q-tooltip>
      </q-btn>
    </template>
  </div>
</template>

<script>
import _ from 'lodash'
import { QBtn, QIcon, QTooltip } from 'quasar'

export default {
  name: 'k-layers-selector',
  components: {
    QBtn,
    QIcon,
    QTooltip
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
    category: {
      type: String,
      default: ''
    },
    exclusive: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    selection () {
      let selection = []
      _.forEach(this.layers, (layer) => {
        if (layer.type === this.category) {
          selection.push(layer)
        }
      })
      return selection
    }
  },
  methods: {
    callHandler(action, layer) {
      if (this.layerHandlers[action]) this.layerHandlers[action](layer)
    },
    onLayerClicked (layer, selection) {
      if (this.exclusive) {
        if (layer.isVisible) return
        let selectedLayer = _.find(selection, { isVisible: true })
        this.callHandler('toggle', selectedLayer)
      }
      this.callHandler('toggle', layer)
    }
  }
}
</script>