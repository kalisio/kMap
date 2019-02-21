import moment from 'moment'
import { Events } from 'quasar'

let timeMixin = {
  data () {
    return {
      currentTime: moment.utc(),
      currentTimeFormat: this.$store.get('timeFormat') || {
        time: {
          short: 'H[h]',
          long: 'HH:mm'
        },
        date: {
          short: 'DD/MM',
          long: 'dddd D'
        },
        year: {
          short: 'YY',
          long: 'YYYY'
        },
        utc: true,
        locale: 'en'
      }
    }
  },
  computed: {
    currentFormattedTime () {
      return {
        time: {
          short: this.formatTime('time.short'),
          long: this.formatTime('time.long')
        },
        date: {
          short: this.formatTime('date.short'),
          long: this.formatTime('date.long')
        },
        year: {
          short: this.formatTime('year.short'),
          long: this.formatTime('year.long')
        },
        iso: this.formatTime('iso')
      }
    }
  },
  methods: {
    convertToMoment(datetime) {
      if (moment.isMoment(datetime)) {
        return datetime
      } else { // Covert from Date, string or milliseconds (ie EPOCH)
        return moment.utc(datetime)
      }
    },
    setCurrentTime (datetime) {
      this.currentTime = this.convertToMoment(datetime)
      this.$emit('current-time-changed', this.currentTime)
    },
    updateTimeFormat (format) {
      this.currentTimeFormat = format
    },
    formatTime(format, datetime) {
      let currentTime = (datetime ? this.convertToMoment(datetime) : this.currentTime)
      if (!this.currentTimeFormat.utc) {
        // Convert to local time
        currentTime = moment(currentTime.valueOf())
      }
      currentTime.locale(this.currentTimeFormat.locale)
      if (format === 'iso') return currentTime.format()
      // Defaults to long mode if not given
      else return currentTime.format(_.get(this.currentTimeFormat, format, _.get(this.currentTimeFormat, format + '.long')))
    }
  },
  created () {
    // Whenever the time format is updated, update data as well
    Events.$on('time-format-changed', this.updateTimeFormat)
  },
  beforeDestroy () {
    Events.$off('time-format-changed', this.updateTimeFormat)
  }
}

export default timeMixin
