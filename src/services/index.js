import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createFeaturesService (options) {
  const app = this

  debug('Creating features service with options', options)
  const paginate = { default: 5000, max: 10000 }
  if (app.get(options.collection)) {
    Object.assign(paginate, app.get(options.collection).paginate || {})
  }
  return app.createService(options.collection, Object.assign({
    fileName: 'features',
    servicesPath,
    modelsPath,
    paginate,
    // FIXME: no real-time events for now since we create big batches,
    // does not seem to be sufficient also require a hook (see https://github.com/feathersjs/feathers/issues/922)
    events: ['features']
  }, options))
}

export function removeFeaturesService (options) {
  // TODO
}

export function createCatalogService (options) {
  const app = this

  debug('Creating catalog service with options', options)
  const paginate = { default: 100, max: 100 }
  if (app.get('catalog')) {
    Object.assign(paginate, app.get('catalog').paginate || {})
  }
  return app.createService('catalog', Object.assign({
    servicesPath,
    modelsPath,
    paginate
  }, options))
}

export function removeCatalogService (context) {
  // TODO
}

export function createGeoAlertsService (options) {
  const app = this

  debug('Creating geoalerts service with options', options)
  return app.createService('geoalerts', Object.assign({
    servicesPath,
    modelsPath,
    events: ['geoalert']
  }, options))
}

export function removeGeoAlertsService (context) {
  // TODO
}

export default async function () {
  const app = this

  debug('Initializing kalisio map')

  app.createService('geocoder', { servicesPath })
}
