<template>
  <div>
    <q-field
      :icon="icon"
      :label="label"
      :hint="helper"
      :error-message="errorLabel"
      :label-width="labelWidth"
      :error="hasError"
    >
      <q-select clearable use-input dropdown-icon="" v-model="pattern" :options="options"
        @filter="onSearch" @input="onSelected" :label="$t('KLocationField.PLACEHOLDER')">
        <template v-slot:no-option>
          <q-item>
            <q-item-section class="text-grey">{{$t('KLocationField.NO_RESULTS')}}</q-item-section>
          </q-item>
        </template>
      </q-select>
      <q-btn icon="place" flat v-if="locationSelected" @click="onMapClicked"/>
    </q-field>
    <k-location-map ref="map" :draggable="properties.draggable" v-bind="properties.field.locationMap" />
  </div>
</template>

<script>
import _ from 'lodash'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'
import { formatGeocodingResult } from '../utils'

export default {
  name: 'k-location-field',
  mixins: [
    kCoreMixins.refsResolver(['map']),
    kCoreMixins.baseField
  ],
  props: {
    minLength: {
      type: Number,
      default: 2
    }
  },
  data () {
    return {
      pattern: '',
      options: []
    }
  },
  computed: {
    locationSelected () {
      return (!_.isNil(this.model.longitude) && !_.isNil(this.model.latitude))
    }
  },
  methods: {
    emptyModel () {
      return {}
    },
    fill (value) {
      this.model = value
      this.pattern = value.name
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
            value: Object.assign(element, { name: label }),
            label: label
          }
          places.push(place)
        })
        update(() => { this.options = places })
      })
    },
    onSelected (result) {
      // Can be null on clear
      this.model = (result ? result.value : {})
    },
    onMapClicked () {
      this.$refs.map.open(this.model)
    }
  },
  created () {
    // load the required components
    this.$options.components['k-location-map'] = this.$load('KLocationMap')
  },
  async mounted () {
    await this.loadRefs()
  }
}
</script>
