<template>
  <div id="map"></div>
</template>

<script>
import * as mixins from '../mixins'

export default {
  name: 'k-map',
  // FIXME: mixins.map.fileLayers,  is broken for now
  mixins: [mixins.map.baseMap, mixins.map.baseLayers, mixins.map.geojsonLayers, mixins.map.fullscreen, mixins.map.scalebar, mixins.map.measure],
  mounted () {
    this.$emit('mapReady')
    /* TESTS
    window.fetch('./statics/airports.json')
    .then(response => response.json())
    .then(geojson => this.addGeoJsonCluster(geojson, 'Airports'))
    */
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