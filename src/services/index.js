import _ from 'lodash'
import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createFeaturesService (options = {}) {
  const app = this

  debug('Creating features service with options', options)
  return app.createService(options.collection, Object.assign({
    fileName: 'features',
    servicesPath,
    modelsPath,
    paginate: { default: 5000, max: 10000 },
    // FIXME: no real-time events for now since we create big batches,
    // does not seem to be sufficient also require a hook (see https://github.com/feathersjs/feathers/issues/922)
    events: ['features']
  }, options))
}

export function removeFeaturesService (options) {
  // TODO
}

export function createCatalogService (options = {}) {
  const app = this

  debug('Creating catalog service with options', options)
  return app.createService('catalog', Object.assign({
    servicesPath,
    modelsPath,
    paginate: { default: 100, max: 100 }
  }, options))
}

export function removeCatalogService (options) {
  // TODO
}

export function createGeoAlertsService (options = {}) {
  const app = this

  debug('Creating geoalerts service with options', options)
  const paginate = { default: 5000, max: 10000 }
  return app.createService('geoalerts', Object.assign({
    servicesPath,
    modelsPath,
    events: ['created', 'removed', 'patched', 'geoalert'],
    paginate
  }, options))
}

export function removeGeoAlertsService (options) {
  // TODO
}

export default async function () {
  const app = this

  debug('Initializing kalisio map')

  const catalogOptions = app.getServiceOptions('catalog')
  if (!_.get(catalogOptions.disabled)) {
    createCatalogService.call(app, catalogOptions)
  }
  const geocoderOptions = app.getServiceOptions('geocoder')
  if (!_.get(geocoderOptions.disabled)) {
    app.createService('geocoder', Object.assign({ servicesPath }, geocoderOptions))
  }
  const alertsOptions = app.getServiceOptions('geoalerts')
  if (!_.get(alertsOptions.disabled)) {
    const alertsService = createGeoAlertsService.call(app, alertsOptions)
    // On startup restore alerts CRON tasks if service not disabled
    if (alertsService) {
      const alerts = await alertsService.find({ paginate: false })
      alerts.forEach(alert => alertsService.registerAlert(alert))
    }
  }

  /*
  app.createService('daptiles', Object.assign({
    servicesPath,
    middlewares: {
      after: [
        (req, res, next) => {
          const buffers = _.get(res.data, 'buffers')
          if (buffers) {
            const binary = Buffer.concat(buffers)
            res.set({
              'Content-Type': 'application/octet-stream'
            }).status(200)
            // for (const buf of buffers) {
            //   // res.send(buf)
            //   res.write(buf)
            // }
            // res.end()
            res.end(binary)
          }
          next()
        }
      ]
    }
  }))
  */
}
