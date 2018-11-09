<template>
  <q-list>
    <q-collapsible icon="map" label="Base layers">
      <div>
        
      </div>
    </q-collapsible>
    <q-collapsible icon="layers" label="Overlay layers">
      <div>
        
      </div>
    </q-collapsible>
  </q-list>
</template>

<script>
import { QList, QCollapsible } from 'quasar'

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
    }
  }
}
</script>

