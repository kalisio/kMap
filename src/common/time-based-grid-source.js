import _ from 'lodash'
import moment from 'moment'
import { makeGridSource, extractGridSourceConfig } from './grid'
import { DynamicGridSource } from './dynamic-grid-source'

export class TimeBasedGridSource extends DynamicGridSource {
  static getKey () {
    return 'time_based'
  }

  constructor (options) {
    super(options)

    this.options = options
  }

  setTime (time) {
    this.queuedCtx.time = time
    this.queueUpdate()
  }

  async setup (config) {
    for (const item of config) {
      const source = {
        from: moment(item.from),
        every: moment.duration(item.every),
        dynamicProps: {}
      }

      if (item.to) source.to = moment(item.to)

      const [key, opts] = extractGridSourceConfig(item)
      source.key = key
      source.staticProps = opts

      for (const prop of _.keys(item.dynprops)) {
        const value = item.dynprops[prop]
        // that's a lodash string template, compile it
        if (value.template) source.dynamicProps[prop] = _.template(value.template)
      }

      this.sources.push(source)
    }
  }

  selectSourceAndDeriveConfig (ctx) {
    let candidate = null
    // select a source for the requested time
    for (const source of this.sources) {
      if (source.to && !ctx.time.isBetween(source.from, source.to)) continue
      if (!ctx.time.isAfter(source.from)) continue

      candidate = source
      break
    }

    let config = null
    if (candidate) {
      // update context
      ctx.stepTime = moment(Math.trunc(ctx.time / candidate.every) * candidate.every)

      // copy 'static' config properties
      config = Object.assign({}, candidate.staticProps)
      // and compute dynamic ones
      for (const prop of _.keys(candidate.dynamicProps)) {
        const value = candidate.dynamicProps[prop](ctx)
        if (value) config[prop] = value
      }
    }

    let source = null
    if (candidate && config) {
      source = makeGridSource(candidate.key, this.options)
    }

    return [source, config]
  }
}
