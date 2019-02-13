import logger from 'winston'
import _ from 'lodash'
import NodeGeocoder from 'node-geocoder'
import makeDebug from 'debug'

const debug = makeDebug('kalisio:kMap:geocoder:service')

export default function (name, app, options) {
    // Keep track of config
  Object.assign(options, app.get('geocoder'))
  debug('geocoder created with config ', options)
  let geocoders = []
  // Single provider ?
  if (options.providers) {
    geocoders = options.providers.map(geocoderOptions => NodeGeocoder(geocoderOptions))
  } else {
    geocoders.push(NodeGeocoder(options))
  }
  return {
    async geocode(geocoder, address) {
      let results = []
      try {
        results = await geocoder.geocode(address)
      } catch (error) {
        logger.error(error)
      }
      return results
    },
    async create (data, params) {
      debug('geocoder service called for create', data)
      let results = await Promise.all(geocoders.map(geocoder => this.geocode(geocoder, data.address)))
      // FIXME: we should order according to best matching
      results = _.flatten(results)
      return results
    }
  }
}
