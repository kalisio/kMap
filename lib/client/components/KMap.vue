<template>
  <div>
    <div id="map" class="row justify-center items-center window-height window-width" style="font-weight: normal; z-index: 0; background-color:#dedede"></div>
  </div>
</template>

<script>
import mixins from '../mixins'

export default {
  name: 'k-map',
  mixins: [mixins.base],
  data () {
    return {
    }
  }
}
</script>
