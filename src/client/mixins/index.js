import geolocation from './mixin.geolocation'
import * as map from './map'
// FIXME: for now avoid using Cesium to create a light package
// import * as globe from './globe'

export default {
  map,
  // globe,
  geolocation
}
