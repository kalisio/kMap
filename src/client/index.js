import makeDebug from 'debug'
import logger from 'loglevel'
import { Platform } from 'quasar'
export * as mixins from './mixins'
export * as utils from './utils'
export * from '../common'

const debug = makeDebug('kalisio:kMap')

export default function init () {
  const api = this

  debug('Initializing kalisio map')

  // Declare the services
  api.declareService('geocoder')

  if (!Platform.is.cordova) return
  window.navigationApps = []

  document.addEventListener('deviceready', _ => {
    // Declare the navigation apps
    window.launchnavigator.availableApps((result) => {
      let apps = Object.entries(result)
      apps.forEach((app) => {
        if (app[1]) window.navigationApps.push(app[0])
      })
    }, (error) => logger.warn('Cannot retrieve installed navigation apps: ' + error))
  })
}
