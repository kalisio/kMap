import _ from 'lodash'
import moment from 'moment'
import { extractGridSourceOptions, makeGridSourceFromKey } from './grid'
import { DynamicGridSource } from './dynamic-grid-source'

export class TimeBasedGridSource extends DynamicGridSource {
  static getKey () {
    return 'time_based'
  }

  /*
  constructor (options) {
    super(options)
  }
  */

  setTime (time) {
    this.queuedCtx.time = time
    this.queueUpdate()
  }

  async setup (options) {
    for (const item of options) {
      const source = {
        from: moment(item.from),
        every: moment.duration(item.every),
        dynamicProps: {}
      }

      if (item.to) source.to = moment(item.to)

      const [key, opts] = extractGridSourceOptions(item)
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

  selectSourceAndDeriveOptions (ctx) {
    let candidate = null
    // select a source for the requested time
    for (const source of this.sources) {
      if (source.to && !ctx.time.isBetween(source.from, source.to)) continue
      if (!ctx.time.isAfter(source.from)) continue

      candidate = source
      break
    }

    let options = null
    if (candidate) {
      // update context
      ctx.stepTime = moment(Math.trunc(ctx.time / candidate.every) * candidate.every)

      // copy 'static' options
      options = Object.assign({}, candidate.staticProps)
      // and compute dynamic ones
      for (const prop of _.keys(candidate.dynamicProps)) {
        const value = candidate.dynamicProps[prop](ctx)
        if (value) options[prop] = value
      }
    }

    let source = null
    if (candidate && options) {
      source = makeGridSourceFromKey(candidate.key)
    }

    return [source, options]
  }
}
