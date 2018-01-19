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
      <q-search ref="search" v-model="pattern" :after="buttons()">
        <q-autocomplete :min-characters="5" :debounce="1000" @search="onSearch" @selected="onSelected" />
      </q-search>
    </q-field>
    <k-location-map :location="model" ref="map" />
  </div>
</template>

<script>
import { QField, QSearch, QAutocomplete } from 'quasar'
import KLocationMap from './KLocationMap.vue'
import { mixins as kCoreMixins } from 'kCore/client'

export default {
  name: 'k-location-field',
  components: {
    QField,
    QSearch,
    QAutocomplete,
    KLocationMap
  },
  mixins: [kCoreMixins.baseField],
  data () {
    return {
      pattern: '',
      map: false
    }
  },
  methods: {
    emptyModel () {
      return {}
    },
    buttons () {
      return [
        {
          icon: 'cancel',
          content: true,
          handler: () => { this.$refs.search.clear() }
        },
        {
          icon: 'place',
          content: true,
          handler: () => this.onMapClicked()
        }
      ]
    },
    onSearch (pattern, done) {
      // Define a default result
      this.model = { name: pattern }
      // Build the list of responses
      const geocoderService = this.$api.getService('geocoder')
      if (! geocoderService) throw Error('Cannot find geocoder service')
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
      this.pattern = result.label
      this.model = result.value
    },
    onMapClicked () {
      this.$refs.map.open()
    }
  }
}
</script>
