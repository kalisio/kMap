<template>
  <div class="row full-width q-pr-xs">
    <!--
      The location input
     -->
    <q-select
      class="col-12"
      borderless
      :dense="dense"
      clearable
      use-input
      v-model="location"
      hide-dropdown-icon
      :options="options"
      option-label="name"
      option-value="name"
      @filter="onSearch" 
      @input="onUpdated">
      <template v-slot:selected>
        {{ locationName }}
      </template>
      <template v-slot:no-option>
        <q-item>
          <q-item-section class="text-grey">
            {{ $t('KLocationField.NO_RESULTS') }}
          </q-item-section>
        </q-item>
      </template>
      <!-- Additionnal actions -->
      <template  v-slot:before>
         <!-- User location -->
        <q-btn v-if="isUserLocationEnabled" icon="my_location" color="primary" flat dense round @click="geolocate()" />
         <!-- Location map -->
        <q-btn v-if="isLocationMapEnabled" icon="place" color="primary" flat dense round>
          <q-popup-proxy transition-show="scale" transition-hide="scale">
            <k-location-map v-model="location" :editable="locationMap.editable" @input="onUpdated" />
          </q-popup-proxy>
        </q-btn>
      </template>
    </q-select>
  </div>
</template>

<script>
import formatcoords from 'formatcoords'
import { formatGeocodingResult } from '../utils'
import * as mixins from '../mixins'

export default {
  name: 'k-location-input',
  mixins: [
    mixins.geolocation
  ],
  props: {
    value: {
      type: Object,
      deafault: () => {
        return null
      }
    },
    minLength: {
      type: Number,
      default: 3
    },
    userLocation: {
      type: Boolean,
      default: true
    },
    locationMap: {
      type: Object,
      default: () => {
        return {
          editable: true
        }
      }
    },
    dense: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    locationName () {
      return this.location ? this.location.name : ''
    },
    isUserLocationEnabled () {
      return this.userLocation
    },
    isLocationMapEnabled () {
      return this.locationMap
    }
  },
  data () {
    return {
      location: null,
      options: []
    }
  },
  methods: {
    geolocate () {
      this.updatePosition()
      let position = this.$store.get('user.position')
      if (position) {
        this.location = {
          name: formatcoords(position.latitude, position.longitude).format(this.$store.get('locationFormat', 'FFf')),
          latitude: position.latitude,
          longitude: position.longitude
        }
      } else {
        this.location = null
      }
      this.$emit('input', this.location)
    },
    onSearch (pattern, update, abort) {
      if (pattern.length < this.minLength) {
        abort()
        return
      }
      // Build the list of responses
      const geocoderService = this.$api.getService('geocoder')
      if (!geocoderService) throw Error('Cannot find geocoder service')
      geocoderService.create({ address: pattern })
      .then(response => {
        let places = []
        response.forEach(element => {
          let label = formatGeocodingResult(element)
          let place = {
            name: label,
            latitude: element.latitude,
            longitude: element.longitude
          }
          places.push(place)
        })
        update(() => { this.options = places })
      })
    },
    onUpdated (value) {
      this.$emit('input', this.location)
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-location-map'] = this.$load('KLocationMap')
    // Populate the component
    if (this.value) this.location = this.value
  }
}
</script>
