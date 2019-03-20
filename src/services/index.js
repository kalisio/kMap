import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createFeatureService (options) {
  const app = this

  debug('feature service created for collection ', options.collection)
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

export function createCatalogService (context, db) {
  const app = this

  debug('catalog service created for context ', context)
  let paginate = { default: 100, max: 100 }
  if (app.get('catalog')) {
    Object.assign(paginate, app.get('catalog').paginate || {})
  }
  return app.createService('catalog', {
    servicesPath,
    modelsPath,
    context,
    db,
    paginate
  })
}

export function removeCatalogService (context) {
  // TODO
}

export default async function () {
  const app = this

  debug('geocoder service created')
  app.createService('geocoder', { servicesPath })
}
