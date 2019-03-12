<template>
  <div class="row justify-center">
    <q-list dense no-border>
      <template v-for="layer in layers">
        <!--q-btn v-if="options.buttons"
          :id ="layer.name" 
          :key="layer.name" 
          round
          :icon="layer.icon"
          :flat="!layer.isVisible" 
          :outline="layer.isVisible" 
          @click="onLayerClicked(layer, selection)">
          <img v-if="!layer.icon" :src="layer.iconUrl" width="32" height="32" />
          <q-tooltip>
            {{layer.name}}
          </q-tooltip>
        </q-btn-->
        <q-item :class="{ selected: layer.isVisible }" :id="layer.name | kebabCase" :key="layer.name" inset-separator link @click="onLayerClicked(layer, layers)">
          <q-item-side v-if="!layer.iconUrl" :icon="layer.icon" left>
          </q-item-side>
          <q-item-side v-else :avatar="layer.iconUrl" left>
          </q-item-side>
          <q-item-main :label="layer.name" :sublabel="layer.description" :tag="layer.isVisible ? 'b' : 'i'"></q-item-main>
          <q-item-side right>
            <!-- Actions -->
            <q-btn id="layer-overflow-menu-entry" v-if="layer.actions && layer.actions.length > 0" flat small round>
              <q-popover id="layer-overflow-menu" :ref="'menu-' + layer.name">
                <q-list>
                  <template v-for="action in layer.actions">
                    <q-item :id="action.name" link :key="key(layer, action.name)" @click="onActionTriggered(action, layer)">
                      <q-item-side :icon="action.icon" />
                      <q-item-main>
                        {{action.label}}
                      </q-item-main>
                    </q-item>
                  </template>
                </q-list>
              </q-popover>
              <q-icon color="grey-7" name="more_vert"></q-icon>
            </q-btn>
          </q-item-side>
        </q-item>
      </template>
    </q-list>
  </div>
</template>

<script>
import _ from 'lodash'
import { QBtn, QIcon, QPopover, QList, QItem, QItemSide, QItemTile, QItemMain, QTooltip } from 'quasar'

export default {
  name: 'k-layers-selector',
  components: {
    QBtn,
    QIcon,
    QList,
    QItem,
    QItemSide,
    QItemTile,
    QItemMain,
    QPopover,
    QTooltip
  },
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
