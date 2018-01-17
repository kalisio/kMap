import NodeGeocoder from 'node-geocoder'
import makeDebug from 'debug'

const debug = makeDebug('kalisio:kMap:geocoder')

export default function (name, app, options) {
    // Keep track of config
  Object.assign(options, app.get('geocoder'))
  debug('geocoder created with config ', options)
  const geocoder = NodeGeocoder(options)
  return {
    create (data, params) {
      debug('geocoder service called for create', data)
      return geocoder.geocode(data.address)
    }
  }
}
