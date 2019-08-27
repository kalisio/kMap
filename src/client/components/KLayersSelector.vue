<template>
  <div>
    <q-list dense>
      <template v-for="layer in layers">
        <q-item :id="layer.name" :key="layer.name" :active="layer.isVisible" active-class="selected" dense v-ripple clickable @click="onLayerClicked(layer)">
          <q-item-section avatar @mouseover="onOverLayer(layer)">
            <q-icon v-if="!layer.iconUrl" :name="layer.icon" />
            <img v-else :src="layer.iconUrl" width="32" />
          </q-item-section>
          <q-item-section @mouseover="onOverLayer(layer)">
            <q-item-label lines="1">
             {{ layer.name }}
            </q-item-label>
            <q-item-label caption lines="2">
             {{ layer.description }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="q-gutter-xs">
              <q-btn id="layer-overflow-menu-entry" v-if="layer.actions && layer.actions.length > 0" icon="more_vert" size="sm" flat round dense @mouseover="onOverLayerMenu(layer)">
                <q-menu :ref="key(layer, 'menu')">
                  <q-list dense>
                    <template v-for="action in layer.actions">
                      <q-item :id="action.name" :key="key(layer, action.name)" clickable @click="onActionTriggered(action, layer)">
                        <q-item-section v-if="action.icon" avatar>
                          <q-icon :name="action.icon" />
                        </q-item-section>
                        <q-item-section>
                          <q-item-label lines="1">
                            {{action.label}}
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </div>
</template>

<script>
import _ from 'lodash'
import { utils as kCoreUtils } from '@kalisio/kdk-core/client'

export default {
  name: 'k-layers-selector',
  props: {
    layers: {
      type: Array,
      default: () => []
    },
    layerHandlers: {
      type: Object,
      default: () => {}
    },
    options: {
      type: Object,
      default: () => {}
    }
  },
  methods: {
    key (layer, action) {
      return layer.name + '-' + action
    },
    layerIcon (layer) {
      return kCoreUtils.getIconName(layer, 'icon')
    },
    callHandler (action, layer) {
      if (this.layerHandlers[action.name]) this.layerHandlers[action.name](layer)
    },
    onLayerClicked (layer) {
      // Open menu whenever required
      if (this.overMenu) {
        // refs can be array due to v-for
        let menu = _.get(this.$refs, `${layer.name}-menu`)
        if (Array.isArray(menu)) menu = menu[0]
        if (menu) menu.toggle()
        return
      }
      // Otherwise standard selection
      if (this.options.exclusive) {
        const selectedLayer = _.find(this.layers, { isVisible: true })
        if (selectedLayer) this.callHandler({ name: 'toggle' }, selectedLayer)
        if (layer === selectedLayer) return
      }
      this.callHandler({ name: 'toggle' }, layer)
    },
    onOverLayer (layer) {
      this.overMenu = false
    },
    onOverLayerMenu (layer) {
      this.overMenu = true
    },
    onActionTriggered (action, layer) {
      // refs are array due to v-for
      const menu = _.get(this.$refs, `${layer.name}-menu[0]`)
      if (menu) menu.hide()
      this.callHandler(action, layer)
    }
  }
}
</script>

<style>
.selected {
  font-weight: bold;
}
</style>
