<template>
  <div class="row justify-center">
    <q-list dense no-border>
      <template v-for="layer in selection">
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
        <q-item :id="layer.name" :key="layer.name" inset-separator link @click="onLayerClicked(layer, selection)">
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
    options: {
      type: Object,
      default: () => {}
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
    key (layer, action) {
      return layer.name + '-' + action
    },
    callHandler(action, layer) {
      if (this.layerHandlers[action.name]) this.layerHandlers[action.name](layer)
    },
    onLayerClicked (layer, selection) {
      if (this.options.exclusive) {
        if (layer.isVisible) return
        let selectedLayer = _.find(selection, { isVisible: true })
        this.callHandler({ name: 'toggle' }, selectedLayer)
      }
      this.callHandler({ name: 'toggle' }, layer)
    },
    onActionTriggered (action, layer) {
      this.$refs['menu-' + layer.name][0].close(() => this.callHandler(action, layer))
    }
  }
}
</script>