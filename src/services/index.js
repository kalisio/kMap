import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createCollectionLayerService (collection) {
  const app = this

  debug('collection layer service created for collection ', collection)
  app.createService(collection, {
    fileName: 'collection-layer',
    servicesPath,
    modelsPath,
    collection
  })
}

export function createLayersService (context, db) {
  const app = this

  debug('layers service created for context ', context)
  let paginate = app.get('layers.paginate')
  if (!paginate) paginate = { default: 100, max: 100 }
  app.createService('layers', {
    servicesPath,
    modelsPath,
    context,
    db,
    paginate
  })
}

export function removeLayersService (context) {
  // TODO
}

export default async function () {
  const app = this

  debug('geocoder service created')
  app.createService('geocoder', { servicesPath })
}
