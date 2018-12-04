<template>
  <k-modal ref="modal" :title="title" :toolbar="toolbar()" :options="modalStyle()" @opened="refreshMap()">
    <div slot="modal-content" class="row justify-center">
      <div ref="map" id="map" :style="mapStyle()"></div>  
    </div>
  </k-modal>
</template>

<script>
import L from 'leaflet'
import _ from 'lodash'
import * as mixins from '../mixins'
import { mixins as kCoreMixins, utils as kCoreUtils } from '@kalisio/kdk-core/client'

export default {
  name: 'k-location-map',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    mixins.map.baseMap
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
      this.center(location.longitude, location.latitude, this.zoom)
      if (!this.place) {
        this.marker = L.marker([location.latitude, location.longitude], { icon: L.icon.fontAwesome(this.markerStyle), draggable: true })
        this.marker.addTo(this.map)
      } else {
        this.marker.setLatLng([location.latitude, location.longitude])
      }
    },
    doClose () {
      this.$refs.modal.close()
      this.location.latitude = this.marker.getLatLng().lat
      this.location.longitude = this.marker.getLatLng().lng
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
    this.$options.components['k-modal'] = this.$load('frame/KModal')
  },
  async mounted () {
    await this.loadRefs()
    this.setupMap()
    this.refreshBaseLayer()
  }
}
</script>
