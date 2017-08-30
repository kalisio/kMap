<template>
  <div>
    <div id="map"></div>
  </div>
</template>

<script>
import L from 'leaflet'
import mixins from '../mixins'

export default {
  name: 'k-map',
  mixins: [mixins.base, mixins.baseLayers, mixins.fullscreen]
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