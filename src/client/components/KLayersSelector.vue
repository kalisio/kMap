<template>
  <div class="row justify-around">
    <template v-for="selector in selectors">
      <q-btn :id ="selector.layer.name" :key="selector.layer.name" round :flat="! selector.toggled" :outline="selector.toggled" @click="onSelectorClicked(selector)">
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
          toggled: false,
          layer: layer
        }
        this.selectors.push(selector)
      })
    },
    onSelectorClicked (selector) {
      if (selector.toggled) return
      if (this.exclusive) {
        _.forEach(this.selectors, (selector) => { 
          if (selector.toggled) selector.toggled = false
        })
      }
      selector.toggled = true
      selector.layer.handler()
    }
  },
  created () {
    this.refreshSelectors()  
  }
}
</script>