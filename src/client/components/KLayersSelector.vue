<template>
  <div class="row justify-around">
    <template v-for="selector in selectors">
      <q-btn 
        :id ="selector.layer.name" 
        :key="selector.layer.name" 
        round 
        :flat="!selector.layer.isVisible" 
        :outline="selector.layer.isVisible" 
        @click="onSelectorClicked(selector)">
        <img :src="selector.layer.iconUrl" width="32" height="32" />
        <q-tooltip>
          {{selector.layer.name}}
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
      type: Array,
      default: () => []
    },
    exclusive: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      selectors: []
    }
  },
  watch: {
    layers: function () {
      this.refreshSelectors()
    }
  },
  methods: {
    refreshSelectors () {
      _.forEach(this.layers, (layer) => {
        let selector = {
          layer: layer
        }
        this.selectors.push(selector)
      })
    },
    onSelectorClicked (selector) {
      if (this.exclusive) { 
        if (selector.layer.isVisible) return
        let selectedLayer = _.find(this.layers, { isVisible: true })
        selectedLayer.handler({ isVisible: false })
      }
      selector.layer.handler({ isVisible: !selector.layer.isVisible })
    }
  },
  created () {
    this.refreshSelectors()  
  }
}
</script>