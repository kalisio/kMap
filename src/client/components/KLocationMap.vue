<template>
  <k-modal 
    ref="modal" :title="title" :toolbar="toolbar()" :options="modalStyle" @opened="refreshMap()">
    <div slot="modal-content">
      <div ref="map" class="map" />
    </div>
  </k-modal>
</template>

<script>
import L from 'leaflet'
import _ from 'lodash'
import * as mapMixins from '../mixins/map'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'

export default {
  name: 'k-location-map',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    mapMixins.baseMap
  ],
  props: {
    draggable: {
      type: Boolean,
      default: false
    },
    mapOptions: {
      type: Object,
      default: () => {
        return {
          maxBounds: [ [-90, -180], [90, 180] ],
          maxBoundsViscosity: 0.25,
          minZoom: 2,
          maxZoom: 18,
          zoom: 15
        }
      }
    },
    modalStyle: {
      type: Object,
      default: () => {
        return {
          minWidth: '60%',
          minHeight: '60%'
        }
      }
    },
    markerStyle: {
      type: Object,
      default: () => {
        return {
          iconClasses: 'fa fa-circle',
          markerColor: '#000000',
          iconColor: '#FFFFFF'
        }
      }
    }
  },
  data () {
    return {
      title: '',
      location: {}
    }
  },
  methods: {
    toolbar () {
      return [
        { name: 'close-action', label: this.$t('KLocationMap.CLOSE_ACTION'), icon: 'close', handler: () => this.doClose() }
      ]
    },
    open (location) {
      if (_.isNil(location.longitude)) throw Error('Invalid location: undefined longitude property')
      if (_.isNil(location.latitude)) throw Error('Invalid location: undefined latitude property')
      if (_.isNil(location.name)) throw Error('Invalid location: undefined name property')
      this.location = location
      this.$refs.modal.open()
      this.title = location.name
      this.center(location.longitude, location.latitude, this.mapOptions.zoom)
      if (!this.marker) {
        this.marker = L.marker([location.latitude, location.longitude], { icon: L.icon.fontAwesome(this.markerStyle), draggable: this.draggable })
        this.marker.addTo(this.map)
      } else {
        this.marker.setLatLng([location.latitude, location.longitude])
      }
    },
    doClose () {
      this.$refs.modal.close()
      if (this.draggable) {
        this.location.latitude = this.marker.getLatLng().lat
        this.location.longitude = this.marker.getLatLng().lng
        this.$emit('location-changed', location)
      }
    },
    async refreshBaseLayer () {
      this.layers = {}
      const catalogService = this.$api.getService('catalog')
      // Get first visible base layer
      let response = await catalogService.find({ query: { type: 'BaseLayer', 'leaflet.isVisible': true } })
      if (response.data.length > 0) this.addLayer(response.data[0])
    }
  },
  created () {
    // load the required components
    this.$options.components['k-modal'] = this.$load('frame/KModal')
  },
  async mounted () {
    await this.loadRefs()
    this.setupMap(this.$refs.map, this.mapOptions)
    this.refreshBaseLayer()
  }
}
</script>

<style>
.map {
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 5rem;
  bottom: 1rem;
  font-weight: normal;
  z-index: 0;
}
</style>
