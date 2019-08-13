<template>
  <div class="row items-center q-pa-none">
    <!--
      The location input
     -->
    <div v-show="isVisible" style="min-width: 40vw; max-width: 40vw;">
      <k-location-input
        class="k-location-bar-frame q-pa-none"
        :location-map="null"
        :dense="true"  
        @input="onLocationChanged" />
    </div>
    <!-- 
        The toggle control
      -->
    <q-btn :icon="toggleIcon" :dense="isToggleDense" color="accent" @click="toggle()" />
  </div>
</template>

<script>
export default {
  name: 'k-location-bar',
  mixins: [
    mixins.geolocation
  ],
  computed: {
    toggleIcon () {
      return this.isVisible ? 'chevron_left' : 'search'
    },
    isToggleDense () {
      return this.isVisible
    }
  },
  data () {
    return {
      isVisible: false
    }
  },
  methods: {
    toggle () {
      this.isVisible = !this.isVisible
    },
    onLocationChanged (location) {
      this.$emit('location-changed', location)
    }
  },
  created () {
    this.$options.components['k-location-input'] = this.$load('KLocationInput')
  }
}
</script>

<style>
.k-location-bar-frame {
  border: solid 1px lightgrey;
  border-radius: 8px;
  background: #ffffff
}

.k-location-bar-frame:hover {
  border: solid 1px grey;
}
</style>
