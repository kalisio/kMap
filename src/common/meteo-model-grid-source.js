import _ from 'lodash'
import moment from 'moment'
import { getNearestRunTime, getNearestForecastTime } from 'weacast-core/common'
import { extractGridSourceOptions, makeGridSourceFromKey } from './grid'
import { DynamicGridSource } from './dynamic-grid-source'

export class MeteoModelGridSource extends DynamicGridSource {
  static getKey () {
    return 'meteo_model'
  }

  setModel (model) {
    this.queuedCtx.model = model
    this.queueUpdate()
  }

  setTime (time) {
    this.queuedCtx.time = time
    this.queueUpdate()
  }

  async setup (options) {
    for (const item of options) {
      const source = {
        model: item.model,
        from: moment(item.from),
        to: moment(item.to),
        dynprops: {}
      }

      const [key, opts] = extractGridSourceOptions(item)
      // source.srcKey = key
      source.src = makeGridSourceFromKey(key)
      source.srcOpt = opts

      for (const prop of _.keys(item.dynprops)) {
        const value = item.dynprops[prop]
        if (value.template) {
          source.dynprops[prop] = _.template(value.template)
        }
      }

      this.sources.push(source)
    }
  }

  selectSourceAndDeriveOptions (ctx) {
    // update context
    ctx.runTime = getNearestRunTime(ctx.time, ctx.model.runInterval)
    ctx.forecastTime = getNearestForecastTime(ctx.time, ctx.model.interval)

    let candidate = null
    for (const source of this.sources) {
      if (source.model !== ctx.model.name) continue
      if (ctx.time.isBetween(source.from, source.to)) {
        candidate = source
        break
      }
    }

    let options = null
    if (candidate) {
      options = Object.assign({}, candidate.srcOpt)
      for (const prop of _.keys(candidate.dynprops)) {
        const value = candidate.dynprops[prop](ctx)
        if (value) {
          options[prop] = value
        }
      }
    }

    return [candidate ? candidate.src : null, options]
  }
}
