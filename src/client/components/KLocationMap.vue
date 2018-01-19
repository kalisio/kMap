<template>
  <k-modal ref="modal" :title="title" :toolbar="toolbar" :options="modalStyle()">
    <div slot="modal-content" class="row justify-center">
      <div ref="map" id="map" :style="mapStyle()"></div>  
    </div>
  </k-modal>
</template>

<script>
import * as mixins from '../mixins'
import { mixins as kCoreMixins } from 'kCore/client'

export default {
  name: 'k-location-map',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    mixins.map.baseMap,
    mixins.map.baseLayers,
    mixins.map.geojsonLayers
  ],
  props: {
    location: {
      type: Object,
      required: true
    },
    marker: {
      type: Object,
      default: () => { 
        return { icon: 'place', color: 'red' }
      }
    },
    layout: {
      type: Object,
      default: () => { 
        return { width: 480, height: 480 }
      }
    }
  },
  computed: {
    title () {
      if (this.location) return this.location.name
      return ''
    }
  },
  data () {
    return {
       toolbar: [
        { name: 'Close', icon: 'close', handler: () => this.doClose() }
      ]
    }
  },
  methods: {
    open () {
      this.$refs.modal.open()
    },
    doClose () {
      this.$refs.modal.close()
    },
    modalStyle () {
      // Is there any better solution to ensure the modal wil fit the map ?
      let modalWidth = this.layout.width * 1.05
      let modalHeight = this.layout.height * 1.25
      return { minWidth: modalWidth + 'px', minHeight: modalHeight + 'px' }
    },
    mapStyle () {
      return { width: this.layout.width + 'px', height: this.layout.height + 'px', fontWeight: 'normal', zIndex: 0, position: 'absolute' }
    }
  },
  created () {
    this.$options.components['k-modal'] = this.$load('frame/KModal')
  },
  mounted () {
    this.loadRefs()
    .then(_ => this.setupMap())
  }
}
</script>
