<template>
  <!--div class="row justify-center"-->
    <q-list dense>
      <template v-for="layer in layers">
        <q-item :id="layer.name" :key="layer.name" clickable :active="layer.isVisible" active-class="bg-grey-2 text-grey-8" @click="onLayerClicked(layer, layers)">
          <q-item-section avatar top>
            <q-icon v-if="!layer.iconUrl" :name="layer.icon" />
            <img v-else :src="layer.iconUrl" width="32" />
          </q-item-section>
          <q-item-section top>
            <q-item-label lines="1">
             {{ layer.name }}
            </q-item-label>
            <q-item-label caption lines="2">
             {{ layer.description }}
            </q-item-label>
          </q-item-section>
          <q-item-section top side>
            <q-btn id="layer-overflow-menu-entry" v-if="layer.actions && layer.actions.length > 0" icon="more_vert" flat small round>
              <q-menu>
                <q-list>
                  <template v-for="action in layer.actions">
                    <q-item :id="action.name" link :key="key(layer, action.name)" @click="onActionTriggered(action, layer)">
                      <q-item-section v-if="!layer.iconUrl" avatar top>
                        <q-icon :name="action.icon" />
                      </q-item-section>
                      <q-item-section top>
                        <q-item-label lines="1">
                          {{action.label}}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </q-menu>   
            </q-btn>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  <!--/div-->
</template>

<script>
import _ from 'lodash'

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
    callHandler (action, layer) {
      if (this.layerHandlers[action.name]) this.layerHandlers[action.name](layer)
    },
    onLayerClicked (layer, layers) {
      if (this.options.exclusive) {
        let selectedLayer = _.find(layers, { isVisible: true })
        if (selectedLayer) this.callHandler({ name: 'toggle' }, selectedLayer)
        if (layer === selectedLayer) return
      }
      this.callHandler({ name: 'toggle' }, layer)
    },
    onActionTriggered (action, layer) {
      this.$refs['menu-' + layer.name][0].close(() => this.callHandler(action, layer))
    }
  }
}
</script>

<style>
.selected {
  background: #e0e0e0;
}
</style>
