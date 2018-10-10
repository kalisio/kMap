<template>
  <div>
    <q-field
      :icon="icon"
      :label="label"
      :helper="helper"
      :error-label="errorLabel"
      :label-width="labelWidth"
      :error="hasError"
    >
      <q-search ref="search" v-model="pattern" :after="actions" @change="onChanged">
        <q-autocomplete :min-characters="5" :debounce="1000" @search="onSearch" @selected="onSelected" />
      </q-search>
    </q-field>
    <k-location-map ref="map" v-bind="properties.field.locationMap" />
  </div>
</template>

<script>
import _ from 'lodash'
import { QField, QSearch, QAutocomplete } from 'quasar'
import KLocationMap from './KLocationMap.vue'
import { mixins as kCoreMixins } from '@kalisio/kCore/client'

export default {
  name: 'k-location-field',
  components: {
    QField,
    QSearch,
    QAutocomplete,
    KLocationMap
  },
  mixins: [kCoreMixins.baseField],
  computed: {
    actions () {
      let buttons = [
        {
          icon: 'cancel',
          content: true,
          handler: () => { this.$refs.search.clear() }
        }
      ]
      if (!_.isNil(this.model.longitude) && !_.isNil(this.model.latitude)) {
        buttons.push({
          icon: 'place',
          content: true,
          handler: () => this.onMapClicked()
        })
      }
      return buttons
    }
  },
  data () {
    return {
      pattern: ''
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
    onChanged (pattern) {
      if (typeof pattern === 'string') this.model = { name: pattern }
      else {
        this.model = pattern
        this.pattern = this.model.name
      }
    },
    onSearch (pattern, done) {
      // Build the list of responses
      const geocoderService = this.$api.getService('geocoder')
      if (!geocoderService) throw Error('Cannot find geocoder service')
      geocoderService.create({ address: pattern })
      .then(response => {
        let places = []
        response.forEach(element => {
          let label = ''
          if (element.streetNumber) label += (element.streetNumber + ' ')
          if (element.streetName) label += (element.streetName + ' ')
          if (element.city) label += (element.city + ' ')
          if (element.zipcode) label += (' (' + element.zipcode + ')')
          let place = {
            value: Object.assign(element, { name: label }),
            label: label
          }
          places.push(place)
        })
        done(places)
      })
    },
    onSelected (result) {
      this.model = result.value
    },
    onMapClicked () {
      this.$refs.map.open(this.model)
    }
  }
}
</script>
