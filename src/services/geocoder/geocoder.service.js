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
    async geocode (geocoder, address) {
      let results = []
      try {
        results = await geocoder.geocode(address)
      } catch (error) {
        logger.error(error)
      }
      return results
    },
    async create (data, params) {
      const nbResults = _.get(this, 'paginate.default', 10)
      debug('geocoder service called for create', data)
      let aggregatedResults = await Promise.all(geocoders.map(geocoder => this.geocode(geocoder, data.address)))
      let results = []
      let processing = true
      // Iterate to take best results for each provider in same order
      while (processing) {
        const previousCount = results.length
        aggregatedResults.forEach(resultsForProvider => {
          // Take current best result
          const bestResultForProvider = resultsForProvider.shift()
          if (bestResultForProvider) results.push(bestResultForProvider)
        })
        // Stop when no more results to be added or pagination exceeded
        if ((previousCount === results.length) || (nbResults <= results.length)) processing = false
      }
      return results.splice(0, nbResults)
    }
  }
}
