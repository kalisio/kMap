import moment from 'moment'

export default {
  data () {
    return {
      timeline: {
        span: moment.duration('P2D'),
        offset: moment.duration('PT0M'),
        step: moment.duration('PT1H'),
        reference: moment.utc(),
        enabled: false
      }
    }
  },
  computed: {
    absoluteTimeline () {
      const halfSpan = this.timeline.span / 2
      const begin = this.timeline.reference.clone().subtract(halfSpan).add(this.timeline.offset)
      const end = this.timeline.reference.clone().add(halfSpan).subtract(this.timeline.offset)
      return {
        begin: begin,
        end: end,
        reference: this.timeline.reference,
        step: this.timeline.step
      }
    }
  },
  methods: {
    enableTimeline () {
      this.timeline.enabled = true
    },
    disableTimeline () {
      this.timeline.enabled = false
    },
    setupTimeline (span, reference, step, offset) {
      this.timeline.span = span
      this.timeline.reference = reference
      this.timeline.offset = offset
      this.timeline.step = step
      this.$emit('timeline-changed', this.absoluteTimeline)
    }
  },
  created () {
  },
  beforeDestroy () {
  }
}
