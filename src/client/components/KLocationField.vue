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
      <q-search ref="search" v-model="pattern" :after="actions" @change="onChanged" :placeholder="$t('KLocationField.PLACEHOLDER')">
        <q-autocomplete :min-characters="5" :debounce="1000" @search="onSearch" @selected="onSelected" />
      </q-search>
    </q-field>
    <k-location-map ref="map" :draggable="properties.draggable" v-bind="properties.field.locationMap" />
  </div>
</template>

<script>
import _ from 'lodash'
import { QField, QSearch, QAutocomplete } from 'quasar'
import { mixins as kCoreMixins } from '@kalisio/kdk-core/client'
import { formatGeocodingResult } from '../utils'

export default {
  name: 'k-location-field',
  components: {
    QField,
    QSearch,
    QAutocomplete
  },
  mixins: [
    kCoreMixins.refsResolver(['map']),
    kCoreMixins.baseField
  ],
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
          let label = formatGeocodingResult(element)
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
