<template>
  <k-modal ref="modal" :title="title" :toolbar="toolbar" :options="modalStyle()" @opened="refreshMap()">
    <div slot="modal-content" class="row justify-center">
      <div ref="map" id="map" :style="mapStyle()"></div>  
    </div>
  </k-modal>
</template>

<script>
import _ from 'lodash'
import * as mixins from '../mixins'
import { mixins as kCoreMixins, utils as kCoreUtils } from 'kCore/client'

export default {
  name: 'k-location-map',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    mixins.map.baseMap,
    mixins.map.baseLayers,
    mixins.map.geojsonLayers
  ],
  props: {
    layout: {
      type: Object,
      default: () => { 
        return { width: 480, height: 480 }
      }
    },
    zoom: {
      type: Number,
      default: 15
    },
    markerStyle: {
      type: Object,
      default: () => {
        return {
			    iconClasses: 'fa fa-circle',
			    markerColor: kCoreUtils.Colors['blue'],
          iconColor: '#FFF'
		    }
      }
    }
  },
  data () {
    return {
      title: '',
      toolbar: [
        { name: 'Close', icon: 'close', handler: () => this.doClose() }
      ]
    }
  },
  methods: {
    open (location) {
      if (_.isNil(location.longitude)) throw Error('Invalid location: undefined longitude property')
      if (_.isNil(location.latitude)) throw Error('Invalid location: undefined latitude property')
      if (_.isNil(location.name)) throw Error('Invalid location: undefined name property')
      this.$refs.modal.open()
      this.title = location.name
      this.center(location.longitude, location.latitude, this.zoom)
      if (!this.place) {
        this.marker = L.marker([location.latitude, location.longitude], { icon: L.icon.fontAwesome(this.markerStyle) })
        this.marker.addTo(this.map)
      } else {
        this.marker.setLatLng([location.latitude, location.longitude]);
      }
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
      return { 
        width: this.layout.width + 'px', 
        height: this.layout.height + 'px', 
        fontWeight: 'normal', 
        zIndex: 0, 
        position: 'absolute' 
      }
    }
  },
  created () {
    this.$options.components['k-modal'] = this.$load('frame/KModal')
  },
  mounted () {
    this.loadRefs()
    .then(() => this.setupMap())
  }
}
</script>
