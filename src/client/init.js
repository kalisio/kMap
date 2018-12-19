import logger from 'loglevel'
import { Platform } from 'quasar'

export function init (api) {
  logger.debug('Initializing kalisio map')

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
