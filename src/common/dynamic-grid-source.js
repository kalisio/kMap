import { GridSource /*, makeGridSource */ } from './grid'

export class DynamicGridSource extends GridSource {
  constructor () {
    super()

    this.sources = []
    this.source = null
    this.queuedId = null
    this.queuedCtx = {}
  }

  getBBox () {
    return this.source ? this.source.getBBox() : null
  }

  getDataBounds () {
    return this.source ? this.source.getDataBounds() : null
  }

  supportsNoData () {
    return this.source ? this.source.supportsNoData() : false
  }

  async fetch (abort, bbox, resolution) {
    return this.source ? this.source.fetch(abort, bbox, resolution) : null
  }

  queueUpdate () {
    if (this.queuedId) return

    this.queuedId = setTimeout(() => {
      this.update(this.queuedCtx)
      this.queuedId = null
    }, 50)
  }

  update (ctx) {
    if (this.source) this.source.off('data-changed', this.onDataChanged)
    const [source, options] = this.selectSourceAndDeriveOptions(ctx)
    this.source = source
    if (this.source) {
      this.onDataChanged = this.dataChanged.bind(this)
      this.source.on('data-changed', this.onDataChanged)
      this.source.setup(options)
    }
  }

  selectSourceAndDeriveOptions (ctx) {
    throw new Error('Not implemented')
  }
}
