<template>
  <div>
    <q-list dense>
      <template v-for="model in forecastModels">
        <q-item :id="model.name" :key="model.name" clickable dense @click="onModelClicked(model)">
          <q-item-section avatar>
            <q-icon v-if="!model.iconUrl" :name="model.icon || 'fas fa-globe'" />
            <img v-else :src="model.iconUrl" width="32" />
          </q-item-section>
          <q-item-section>
            <q-item-label lines="1">
             {{ model.label }}
            </q-item-label>
            <q-item-label caption lines="2">
             {{ model.description }}
            </q-item-label>
          </q-item-section>
          <q-item-secion side>
            <q-btn 
              id="model-selector-entry" 
              :icon="model.name === selected.name ? 'visibility_off' : 'visibility'" 
              :color="model.name === selected.name ? 'primary' : 'grey'" 
              size="md" flat round dense 
              @click="onModelClicked(model)" />
          </q-item-secion>
      </q-item>
      </template>
    </q-list>
  </div>
</template>

<script>
export default {
  name: 'k-forecast-models-selector',
  data () {
    return {
      selected: {}
    }
  },
  props: {
    forecastModels: {
      type: Array,
      default: () => []
    },
    forecastModelHandlers: {
      type: Object,
      default: () => {}
    },
    forecastModel: {
      type: Object,
      default: () => {}
    }
  },
  watch: {
    forecastModel: function (model) {
      this.selected = model
    }
  },
  methods: {
    callHandler (action, layer) {
      if (this.forecastModelHandlers[action]) this.forecastModelHandlers[action](layer)
    },
    onModelClicked (model) {
      this.callHandler('toggle', model)
    }
  },
  created () {
    this.selected = this.forecastModel
  }
}
</script>

