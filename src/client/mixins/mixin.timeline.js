import _ from 'lodash'
import moment from 'moment'

export default {
  data () {
    const now = moment.utc()
    return {
      timeline: {
        start: now.clone().subtract({ days: 7 }).valueOf(),
        end: now.clone().add({ days: 7 }).valueOf(),
        current: now.clone().valueOf()
      },
      timelineInterval: null,
      timelineFormatter: null,
      timelineRefreshKey: 0
    }
  },
  computed: {
    timelineContainerStyle () {
      return {
        width: 0.8 * this.engineContainerWidth + 'px'
      }
    },
    timelineEnabled () {
      // For now only weather forecast requires timeline
      return (_.values(this.layers).find(layer => layer.isVisible && layer.tags && layer.tags.includes('weather')) ||
          this.isTimeseriesOpen())
    }
  },
  methods: {
    updateTimeline (options) {
      if (options.start) this.timeline.start = options.start
      if (options.end) this.timeline.end = options.end
      // Clamp current time to range
      this.timeline.current = Math.max(Math.min(options.current, this.timeline.end), this.timeline.start)
      //
      // Make the component aware that it needs to refresh.
      //
      // See: http://michaelnthiessen.com/force-re-render and related to: https://github.com/kalisio/kano/issues/24
      //
      // Core issue is that the :value property of k-time-controller can be changed by this method, but this does not
      // affect the data element "this.currentValue" of the component which is only assigned once (see the expression
      // "currentValue: this.value" in mixin.range-compute.js).
      //
      // Since invoking "setupTimeline" means that the whole component simply needs to be recalculated (because we're
      // changing any/all of its props), forcing an update (using the ":key" technique) seem the simplest solution.
      //
      this.timelineRefreshKey = this.timelineRefreshKey + 1
    },
    setupTimeline () {
      this.timelineInterval = this.getTimelineInterval()
      this.timelineFormatter = this.getTimelineFormatter()
      const now = moment.utc()
      // Start just before the first available data
      let start = this.forecastModel ? this.forecastModel.lowerLimit - this.forecastModel.interval : -7 * 60 * 60 * 24
      // Override by config ?
      start = _.get(this, 'activityOptions.timeline.start', start)
      // Start just after the last available data
      let end = this.forecastModel ? this.forecastModel.upperLimit + this.forecastModel.interval : 7 * 60 * 60 * 24
      // Override by config ?
      end = _.get(this, 'activityOptions.timeline.end', end)
      this.updateTimeline({
        start: now.clone().add({ seconds: start }).valueOf(),
        end: now.clone().add({ seconds: end }).valueOf(),
        current: this.timeline.current
      })
      this.setCurrentTime(moment.utc(this.timeline.current))
      this.$emit('timeline-changed', this.timeline)
    },
    getTimelineInterval () {
      // interval length: length of 1 day in milliseconds
      const length = 24 * 60 * 60000

      return {
        length,
        getIntervalStartValue (rangeStart) {
          const startTime = moment.utc(rangeStart)
          startTime.local()
          const hour = startTime.hours()
          const minute = startTime.minutes()
          let startValue
          // range starts on a day (ignoring seconds)
          if (hour === 0 && minute === 0) {
            startValue = rangeStart
          } else {
            const startOfDay = startTime.startOf('day')
            startOfDay.add({ days: 1 })
            startValue = startOfDay.valueOf()
          }
          return startValue
        },
        valueChanged (value, previousValue, step) {
          let changed = true
          if (step !== null) {
            changed = false
            if (previousValue === null) {
              changed = true
            } else {
              const difference = Math.abs(value - previousValue)
              switch (step) {
                case 'h':
                  changed = (difference >= 60 * 60000)
                  break
                case 'm':
                  changed = (difference >= 60000)
                  break
                default:
                  changed = true
              }
            }
          }
          return changed
        }
      }
    },
    getTimelineFormatter () {
      return {
        format: (value, type, displayOptions) => {
          const time = new Date(value)
          let label
          switch (type) {
            case 'interval':
              if (displayOptions.width >= 110) {
                label = this.formatTime('date.long', time)
              } else {
                label = this.formatTime('date.short', time)
              }
              break
            case 'pointer':
              label = `${this.formatTime('date.long', time)} - ${this.formatTime('time.short', time)}`
              break
            case 'indicator':
              label = this.formatTime('time.short', time)
              break
          }
          return label
        }
      }
    },
    onTimelineUpdated (event) {
      // Only when drag stops to avoid fetching data permanently
      if (event.final) {
        this.setCurrentTime(moment.utc(event.value))
      }
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-time-controller'] = this.$load('time/KTimeController')
  },
  mounted () {
    this.$on('forecast-model-changed', this.setupTimeline)
  },
  beforeDestroy () {
    this.$off('forecast-model-changed', this.setupTimeline)
  }
}
