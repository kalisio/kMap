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
        <q-autocomplete :debounce="1000" @search="onSearch" @selected="onSelected" />
      </q-search>
    </q-field>
  </div>
</template>

<script>
import { QField, QSearch, QAutocomplete } from 'quasar'
import KMap from './KMap.vue'
import { mixins as kCoreMixins } from 'kCore/client'

export default {
  name: 'k-location-field',
  components: {
    QField,
    QSearch,
    QAutocomplete
  },
  mixins: [kCoreMixins.baseField],
  data () {
    return {
      pattern: ''
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
          handler: () => this.onView()
        }
      ]
    },
    onSearch (pattern, done) {
      if (pattern.length > 4) {
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
              value: element,
              label: label
            }
            places.push(place)
          })
          done(places)
        })
      }
    },
    onSelected (result) {
      this.pattern = result.label
      this.model = result.element
    },
    onView () {
      // TODO
    }
  }
}
</script>
