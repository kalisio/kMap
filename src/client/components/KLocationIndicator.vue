<template>
  <q-chip color="secondary" closable class="fixed-center" style="top: 32px" @click="onClick()" @close="onClose()">
    {{ currentFormattedLocation }}
  </q-chip>
</template>

<script>
import formatcoords from 'formatcoords'
import { QChip } from 'quasar'

export default {
  name: 'k-location-indicator',
  components: {
    QChip
  },
  computed: {
    currentFormattedLocation () {
      return formatcoords(this.location).format(this.locationFormat)
    }
  },
  props: {
    location: {
      type: Array,
      default: () => [0, 0]
    },
    locationFormat: {
      type: String,
      default: 'FFf'
    },
  },
  methods: {
    onClick () {
      this.$emit('click')
    },
    onClose () {
      this.$emit('close')
    }
  }
}
</script>
