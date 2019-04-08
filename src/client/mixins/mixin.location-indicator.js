import Vue from 'vue'
import { Events, QChip } from 'quasar'
import KLocationIndicator from '../components/KLocationIndicator.vue'

let locationIndicatorMixin = {
  data () {
    return {
      currentLocation: [0, 0],
      currentLocationFormat: this.$store.get('locationFormat') || 'FFf'
    }
  },
  methods: {
    createLocationIndicator () {
      if (this.locationIndicator) return
      const Component = Vue.extend(KLocationIndicator)
      this.locationIndicator =  new Component({
        propsData: {
          location: this.currentLocation,
          locationFormat: this.currentLocationFormat
        }
      })
      this.locationIndicator.$on('close', this.removeLocationIndicator)
      this.locationIndicator.$mount()
      this.$el.appendChild(this.locationIndicator.$el)
    },
    removeLocationIndicator () {
      if (!this.locationIndicator) return
      this.locationIndicator.$off('close', this.removeLocationIndicator)
      this.$el.removeChild(this.locationIndicator.$el)
      this.locationIndicator = null
    },
    setLocationFormat (format) {
      this.currentLocationFormat = format
    },
    updateLocationIndicator (options, event) {
      if (Array.isArray(event.latlng)) {
        this.currentLocation = event.latlng
      } else if (typeof event.latlng === 'object') {
        this.currentLocation = [event.latlng.lat, event.latlng.lng]
      }
      this.locationIndicator.location = this.currentLocation
    }
  },
  created () {
    // Whenever the location format is updated, update indicator as well
    Events.$on('location-format-changed', this.setLocationFormat)
    this.$on('mousemove', this.updateLocationIndicator)
  },
  beforeDestroy () {
    Events.$off('location-format-changed', this.setLocationFormat)
    this.$off('mousemove', this.updateLocationIndicator)
  }
}

export default locationIndicatorMixin
