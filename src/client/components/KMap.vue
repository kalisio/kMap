<template>
  <div id="map"></div>
</template>

<script>
import * as mixins from '../mixins'

export default {
  name: 'k-map',
  mixins: [mixins.map.baseMap, mixins.map.baseLayers, mixins.map.fullscreen, mixins.map.scalebar, mixins.map.measure],
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