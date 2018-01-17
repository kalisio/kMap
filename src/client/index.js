import makeDebug from 'debug'
export * as mixins from './mixins'
export * from '../common'

const debug = makeDebug('kalisio:kMap')

export default function init () {
  const api = this

  debug('Initializing kalisio map')

  api.declareService('geocoder')
}
