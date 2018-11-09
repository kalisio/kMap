import path from 'path'
import makeDebug from 'debug'
const modelsPath = path.join(__dirname, '..', 'models')
const servicesPath = path.join(__dirname, '..', 'services')

const debug = makeDebug('kalisio:kMap:services')

export function createLayersService (context, db) {
  const app = this

  debug('layers service created for context ', context)
  app.createService('layers', {
    servicesPath,
    modelsPath,
    context,
    db
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
