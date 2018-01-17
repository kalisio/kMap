<template>
  <q-field
    :icon="icon"
    :label="label"
    :helper="helper"
    :error-label="errorLabel"
    :label-width="labelWidth"
    :error="hasError"
  >
    <q-search v-model="places">
      <q-autocomplete @search="onSearch" @selected="onSelected" />
    </q-search>
  </q-field>
</template>

<script>
import { QField, QSearch, QAutocomplete } from 'quasar'
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
    onSearch (pattern, done) {
      if (pattern.length > 5) {
        const geocoderService = this.$api.getService('geocoder')
        if (! geocoderService) throw Error('Cannot find geocoder service')
        console.log(geocoderService)
        geocoderService.create({ address: pattern })
        .then(response => {
          console.log(response)
        })
      }
      done()
    },
    onSelected (result) {
      this.model = result.place
    }
  }
}
</script>
