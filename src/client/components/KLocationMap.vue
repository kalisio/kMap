<template>
  <div ref="map" style="width: 100%; height: 100%; fontWeight: normal; zIndex: 0; position: absolute;" >
    <q-resize-observer @resize="onMapResized" />
  </div>
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
    markerStyle: {
      type: Object,
      default: () => {
        return {
          iconClasses: 'fas fa-circle',
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
    async initialize (location) {
      if (_.isNil(location.longitude)) throw Error('Invalid location: undefined longitude property')
      if (_.isNil(location.latitude)) throw Error('Invalid location: undefined latitude property')
      if (_.isNil(location.name)) throw Error('Invalid location: undefined name property')
      this.location = location
      this.title = location.name
      this.center(location.longitude, location.latitude, this.mapOptions.zoom)
      if (!this.marker) {
        this.marker = L.marker([location.latitude, location.longitude], {
          icon: L.icon.fontAwesome(this.markerStyle), draggable: this.draggable
        })
        this.marker.addTo(this.map)
        if (this.draggable) this.marker.on('dragend', this.updateLocation)
      } else {
        this.marker.setLatLng([location.latitude, location.longitude])
      }
    },
    updateLocation () {
      this.location.latitude = this.marker.getLatLng().lat
      this.location.longitude = this.marker.getLatLng().lng
      this.$emit('location-changed', location)
    },
    async refreshBaseLayer () {
      this.layers = {}
      const catalogService = this.$api.getService('catalog', '')
      // Get first visible base layer
      let response = await catalogService.find({ query: { type: 'BaseLayer', 'leaflet.isVisible': true } })
      if (response.data.length > 0) this.addLayer(response.data[0])
    },
    onMapResized (size) {
      this.refreshMap()
    }
  },
  async mounted () {
    await this.loadRefs()
    this.setupMap(this.$refs.map, this.mapOptions)
    await this.refreshBaseLayer()
    this.$emit('map-ready')
  }
}
</script>
