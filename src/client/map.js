import * as commonMixins from './mixins'
import * as mapMixins from './mixins/map'
import { init as initialize } from './init'

export * as utils from './utils'
export * from '../common'
export * from './init'

let mixins = Object.assign({}, commonMixins, { map: mapMixins })
export { mixins }

export default function init () { 
  const api = this
  return initialize(api)
}
