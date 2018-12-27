import * as commonMixins from './mixins'
import * as mapMixins from './mixins/map'
import * as globeMixins from './mixins/globe'
import init from './init'

export * as utils from './utils'
export * from '../common'

let mixins = Object.assign({}, commonMixins, { map: mapMixins, globe: globeMixins })
export { mixins }

export default init
