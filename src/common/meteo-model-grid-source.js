import _ from 'lodash'
import moment from 'moment'
import { getNearestRunTime, getNearestForecastTime } from 'weacast-core/common'
import { makeGridSource, extractGridSourceConfig } from './grid'
import { DynamicGridSource } from './dynamic-grid-source'

export class MeteoModelGridSource extends DynamicGridSource {
  static getKey () {
    return 'meteo_model'
  }

  constructor (options) {
    super(options)

    this.options = options
  }

  setModel (model) {
    this.queuedCtx.model = model
    this.queueUpdate()
  }

  setTime (time) {
    this.queuedCtx.time = time
    this.queueUpdate()
  }

  async setup (config) {
    console.log(config)
    for (const item of config) {
      const source = {
        model: item.model,
        from: moment(item.from),
        dynamicProps: {}
      }

      if (item.to) source.to = moment(item.to)

      const [key, conf] = extractGridSourceConfig(item)
      source.key = key
      source.staticProps = conf

      for (const prop of _.keys(item.dynprops)) {
        const value = item.dynprops[prop]
        // that's a lodash string template, compile it
        if (value.template) source.dynamicProps[prop] = _.template(value.template)
      }

      this.sources.push(source)
    }
  }

  selectSourceAndDeriveConfig (ctx) {
    // update context
    ctx.runTime = getNearestRunTime(ctx.time, ctx.model.runInterval)
    ctx.forecastTime = getNearestForecastTime(ctx.time, ctx.model.interval)

    let candidate = null
    // select a source for the requested time
    for (const source of this.sources) {
      if (source.model !== ctx.model.name) continue
      if (source.to && !ctx.time.isBetween(source.from, source.to)) continue
      if (!ctx.time.isAfter(source.from)) continue

      candidate = source
      break
    }

    let config = null
    if (candidate) {
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
