import * as commonMixins from './mixins'
import * as globeMixins from './mixins/globe'
import { init as initialize } from './init'

export * as utils from './utils'
export * from '../common'
export * from './init'

let mixins = Object.assign({}, commonMixins, { globe: globeMixins })
export { mixins }

export default function init () { 
  const api = this
  return initialize(api)
}
