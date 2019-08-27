import * as commonMixins from './mixins'
import * as mapMixins from './mixins/map'
import * as globeMixins from './mixins/globe'
import * as utils from './utils'
import init from './init'

export { utils }
export * from '../common'

const mixins = Object.assign({}, commonMixins, { map: mapMixins, globe: globeMixins })
export { mixins }

export default init
