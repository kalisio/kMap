import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createFeatureService (collection) {
  const app = this

  debug('feature service created for collection ', collection)
  let paginate = { default: 3000, max: 10000 }
  if (app.get('feature')) {
    Object.assign(paginate, app.get('feature').paginate || {})
  }
  app.createService(collection, {
    fileName: 'feature',
    servicesPath,
    modelsPath,
    collection,
    paginate
  })
}

export function createCatalogService (context, db) {
  const app = this

  debug('catalog service created for context ', context)
  let paginate = { default: 100, max: 100 }
  if (app.get('catalog')) {
    Object.assign(paginate, app.get('catalog').paginate || {})
  }
  app.createService('catalog', {
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
