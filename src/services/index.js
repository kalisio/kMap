import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createFeatureService (options) {
  const app = this

  debug('Creating feature service with options', options)
  let paginate = { default: 5000, max: 10000 }
  if (app.get(options.collection)) {
    Object.assign(paginate, app.get(options.collection).paginate || {})
  }
  return app.createService(options.collection, Object.assign({
    fileName: 'feature',
    servicesPath,
    modelsPath,
    paginate
  }, options))
}

export function removeFeatureService (options) {
  // TODO
}

export function createCatalogService (options) {
  const app = this

  debug('Creating catalog service with options', options)
  let paginate = { default: 100, max: 100 }
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

export default async function () {
  const app = this

  debug('geocoder service created')
  app.createService('geocoder', { servicesPath })
}
