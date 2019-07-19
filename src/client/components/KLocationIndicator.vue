<template>
  <div class="column items-center fixed-bottom" style="bottom: 32px" >
    <q-chip color="secondary" text-color="white" closable  @click="onClick()" @close="onClose()">
      {{ currentFormattedLocation }}
    </q-chip>
  </div>
</template>

<script>
import formatcoords from 'formatcoords'

export default {
  name: 'k-location-indicator',
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
    }
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
