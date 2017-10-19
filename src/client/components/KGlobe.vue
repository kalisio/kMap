<template>
  <div id="globe"></div>
</template>

<script>
import * as mixins from '../mixins'

export default {
  name: 'k-globe',
  mixins: [mixins.globe.baseGlobe, mixins.globe.baseLayers, mixins.globe.geojsonLayers, mixins.globe.fileLayers],
  mounted () {
    this.$emit('globeReady')
    /* TESTS
    this.addGeoJsonCluster('./statics/airports.json', 'Airports', this.convertFromSimpleStyleSpec({
      markerSymbol: 'airport',
      markerColor: '#57D824'
    }))
    */
  }
}
</script>

<style>
#globe {
  width: 100%;
  height: 100%;
  font-weight: normal;
  z-index: 0;
  position: absolute;
}
</style>
