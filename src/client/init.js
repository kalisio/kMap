import logger from 'loglevel'
import { Platform } from 'quasar'
import { Store, utils as kCoreUtils } from '@kalisio/kdk-core/client'

export default function init () {
  const api = this

  logger.debug('Initializing kalisio map')

  // Declare the services
  api.declareService('geocoder')

  // Initialize the nabigation bar
  const navigationBar = { locationInput: false, actions: { before: [], after: [] } }
  Store.set('navigationBar', navigationBar)

  // Default time formatting settings
  Store.set('timeFormat', {
    time: {
      short: 'H[h]',
      long: 'HH:mm'
    },
    date: {
      short: 'DD/MM',
      long: 'dddd D'
    },
    year: {
      short: 'YY',
      long: 'YYYY'
    },
    utc: false,
    locale: kCoreUtils.getLocale()
  })
  // Default location formatting settings
  Store.set('locationFormat', 'f')
  // Default view settings
  Store.set('restore', {
    view: true,
    layers: false
  })
  // Default timeline parameters
  Store.set('timeline', {
    span: 15, // days
    offset: 7, // days
    step: 60, // minutes
    reference: null // now
  })
  // Default timeseries parameters
  Store.set('timeseries', {
    span: 1 // days
  })

  if (!Platform.is.cordova) return
  window.navigationApps = []

  document.addEventListener('deviceready', _ => {
    // Declare the navigation apps
    window.launchnavigator.availableApps((result) => {
      const apps = Object.entries(result)
      apps.forEach((app) => {
        if (app[1]) window.navigationApps.push(app[0])
      })
    }, (error) => logger.warn('Cannot retrieve installed navigation apps: ' + error))
  })
}
