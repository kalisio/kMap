<template>
  <div id="map"></div>
</template>

<script>
import L from 'leaflet'
import * as mixins from '../mixins'

export default {
  name: 'k-map',
  mixins: [mixins.vue.baseMap, mixins.vue.baseLayers, mixins.vue.fullscreen, mixins.vue.scalebar, mixins.vue.measure],
  mounted () {
    this.$emit('mapReady')
  }
}
</script>

<style>
#map {
  width: 100%;
  height: 100%;
  font-weight: normal;
  z-index: 0;
  position: absolute;
}
</style>