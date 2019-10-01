<template>
  <div>
    <q-expansion-item default-opened icon="fas fa-clock" :label="$t('KGeoAlertForm.TIME_PERIOD')" group="group">
      <q-list dense class="q-pa-md">
        <q-item>
          <q-item-section avatar>
            <q-select v-model="period.start" :options="times" emit-value map-options>
              <template v-slot:prepend><q-icon name="fas fa-minus" /></template>
            </q-select>
          </q-item-section>
          <q-item-section>
          {{$t('KGeoAlertForm.TIME_PERIOD_RANGE')}}
          </q-item-section>
          <q-item-section avatar>
            <q-select v-model="period.end" :options="times" emit-value map-options>
              <template v-slot:prepend><q-icon name="fas fa-plus" /></template>
            </q-select>
          </q-item-section>
          <q-item-section>
            {{$t('KGeoAlertForm.FREQUENCY')}}
          </q-item-section>
          <q-item-section avatar>
            <q-select v-model="frequency" :options="frequencies" emit-value map-options>
              <template v-slot:prepend><q-icon name="fas fa-minus" /></template>
            </q-select>
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
    <q-expansion-item default-opened icon="fab fa-cloudversify" :label="$t('KGeoAlertForm.CONDITIONS')" group="group">
      <q-list dense class="q-pa-md">
        <q-item v-for="(variable, index) in variables">
          <q-item-section avatar>
            {{$t(variable.label)}}
          </q-item-section>
          <q-item-section avatar>
            <q-select v-model="conditions[index].operator" :options="operators" emit-value map-options/>
          </q-item-section>
          <q-item-section>
            <q-slider v-model="conditions[index].threshold"
              :min="conditions[index].min" :max="conditions[index].max" :step="conditions[index].step"
              label label-always :label-value="conditions[index].threshold + ' ' + getUnits(variable)"/>
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
  </div>
</template>

<script>
import _ from 'lodash'
import moment from 'moment'
import { mixins as kCoreMixins, utils as kCoreUtils } from '@kalisio/kdk-core/client'
import { QSlider } from 'quasar'

export default {
  name: 'k-geoalert-form',
  components: {
    QSlider
  },
  mixins: [
    kCoreMixins.schemaProxy,
    kCoreMixins.refsResolver()
  ],
  props: {
    variables: { type: Array, default: () => [] },
    feature: { type: Object, default: () => {} }
  },
  data () {
    return {
      period: {
        start: 0,
        end: 24
      },
      frequency: 6,
      times: [{
        label: '0H',
        value: 0
      }, {
        label: '12H',
        value: 12
      }, {
        label: '24H',
        value: 24
      }, {
        label: '48H',
        value: 48
      }],
      frequencies: [{
        label: '1H',
        value: 1
      }, {
        label: '3H',
        value: 3
      }, {
        label: '6H',
        value: 6
      }, {
        label: '12H',
        value: 12
      }, {
        label: '24H',
        value: 24
      }],
      operators: [{
        label: this.$i18n.t('KGeoAlertForm.GREATER_THAN'),
        value: '$gte'
      }, {
        label: this.$i18n.t('KGeoAlertForm.LOWER_THAN'),
        value: '$lte'
      }],
      conditions: {}
    }
  },
  methods: {
    getUnits (variable) {
      return _.get(variable, 'units[0]', '')
    },
    async build () {
      // Since some properties are injected in form we need to make sure Vue.js has processed props
      // This could be done externally but adding it here we ensure no one will forget it
      await this.$nextTick()
      // Initialize conditions object matching variables
      this.conditions = this.variables.map(variable => {
        const min = _.get(variable, 'range[0]', 0)
        const max = _.get(variable, 'range[1]', 100)
        return {
          operator: '$gte', threshold: (max-min) * 0.5, // Mean value
          min, max, step: Math.floor((max-min) / 0.05) // 5%
        }
      })
    },
    async fill (object) {
      period.start = _.get(object, 'period.start.hours')
      period.end = _.get(object, 'period.end.hours')
    },
    values () {
      const values = {}
      _.set(values, 'period.start.hours', period.start)
      _.set(values, 'period.end.hours', period.end)
      return values
    },
    clear () {
      period.start = 0
      period.end = 24
    },
    validate () {
      return {
        isValid: true,
        values: this.values()
      }
    },
    async apply (object) {
      Object.assign(object, this.values())
    },
    submitted (object) {
    }
  },
  async created () {
    await this.build()
    this.$emit('form-ready', this)
  }
}
</script>
