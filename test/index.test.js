import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import path from 'path'
import _ from 'lodash'
import fs from 'fs-extra'
import core, { kalisio, permissions } from '@kalisio/kdk-core'
import map, { permissions as mapPermissions, createCollectionLayerService } from '../src'

const modelsPath = path.join(__dirname, '..', 'src', 'models')
const servicesPath = path.join(__dirname, '..', 'src', 'services')

describe('kMap', () => {
  let app, server, port, // baseUrl,
    userService, userObject, geocoderService, layersService, layersArray,
    vigicruesStationsService, vigicruesObsService

  before(() => {
    chailint(chai, util)

    // Register all default hooks for authorisation
    // Default rules for all users
    permissions.defineAbilities.registerHook(permissions.defineUserAbilities)
    // Then rules for maps
    permissions.defineAbilities.registerHook(mapPermissions.defineUserAbilities)

    app = kalisio()
    port = app.get('port')
    // baseUrl = `http://localhost:${port}${app.get('apiPath')}`
    return app.db.connect()
  })

  it('is CommonJS compatible', () => {
    expect(typeof core).to.equal('function')
  })

  it('registers the services', (done) => {
    app.configure(core)
    userService = app.getService('users')
    expect(userService).toExist()
    app.configure(map)
    geocoderService = app.getService('geocoder')
    expect(geocoderService).toExist()
    // Create a global layers service
    app.createService('layers', { modelsPath, servicesPath })
    layersService = app.getService('layers')
    expect(layersService).toExist()
    // Now app is configured launch the server
    server = app.listen(port)
    server.once('listening', _ => done())
  })
  // Let enough time to process
  .timeout(5000)

  it('creates a test user', async () => {
    userObject = await userService.create({ email: 'test-user@test.org', name: 'test-user' }, { checkAuthorisation: true })
    let users = await userService.find({ query: { 'profile.name': 'test-user' }, user: userObject, checkAuthorisation: true })
    expect(users.data.length > 0).beTrue()
  })

  it('registers the default layers', async () => {
    let layers = await fs.readJson('./test/config/layers.json')
    expect(layers.length > 0)
    layersArray = await layersService.create(layers)
    expect(layersArray.length > 0)
  })

  it('create and feed the vigicrues stations service', async () => {
    // Create the service
    const vigicruesStationsLayer = _.find(layersArray, { name: 'vigicrues-stations' })
    expect(vigicruesStationsLayer).toExist()
    expect(vigicruesStationsLayer.collection === 'vigicrues-stations').beTrue()
    createCollectionLayerService.call(app, vigicruesStationsLayer.collection)
    vigicruesStationsService = app.getService(vigicruesStationsLayer.collection)
    expect(vigicruesStationsService).toExist()
    // Create the spatial index
    vigicruesStationsService.Model.ensureIndex({ geometry: '2dsphere' })
    // Feed the collection
    let stations = require('./data/vigicrues.stations.json').features
    await vigicruesStationsService.create(stations)
  })

  it('create and feed the vigicrues observations service', async () => {
    // Create the service
    const vigicruesObsLayer = _.find(layersArray, { name: 'vigicrues-observations' })
    expect(vigicruesObsLayer).toExist()
    expect(vigicruesObsLayer.collection === 'vigicrues-observations').beTrue()
    createCollectionLayerService.call(app, vigicruesObsLayer.collection)
    vigicruesObsService = app.getService(vigicruesObsLayer.collection)
    expect(vigicruesObsService).toExist()
    // Feed the collection
    let observations = require('./data/vigicrues.observations.json')
    await vigicruesObsService.create(observations)
  })

  it('performs spatial filtering on vigicrues stations service', async () => {
    let results = await vigicruesStationsService.find({
      paginate: false,
      query: {
        geometry: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [ 6.39, 48.31 ]
            },
            $maxDistance: 100000 // 100 Kms around
          }
        }
      }
    })
    expect(results.length > 0).beTrue()
  })

  it('performs value filtering on vigicrues observations service', async () => {
    let results = await vigicruesObsService.find({
      paginate: false,
      query: {
        'properties.H': { $gt: 0.33, $lt: 0.5 }
      }
    })
    expect(results.length > 0).beTrue()
  })

  it('performs temporal filtering on vigicrues observations service', async () => {
    let results = await vigicruesObsService.find({
      paginate: false,
      query: {
        time: {
          $gt: new Date('2018-11-08T18:00:00').toISOString(),
          $lt: new Date('2018-11-08T22:00:00').toISOString()
        }
      }
    })
    expect(results.length > 0).beTrue()
  })

  it('performs element aggregation on vigicrues observations service', async () => {
    let query = {
      time: {
        $gte: new Date('2018-11-08T18:00:00Z').toISOString(),
        $lte: new Date('2018-11-08T22:00:00Z').toISOString()
      },
      'properties.CdStationH': 'A282000101',
      $groupBy: 'properties.CdStationH',
      $aggregate: ['H']
    }
    let results = await vigicruesObsService.find({
      paginate: false,
      query
    })
    expect(results.length).to.equal(1)
    const feature = results[0]
    expect(feature.time.length === 5).beTrue()
    expect(feature.H.length === 5).beTrue()
  })

  it('geocode an address', async () => {
    let address = '80 chemin des tournesols, 11400 Castelnaudary'
    let response = await geocoderService.create({ address: address }, { user: userObject, checkAuthorisation: true })
    expect(response.length === 1).beTrue()
    expect(response[0].latitude).toExist()
    expect(response[0].longitude).toExist()
  })

  it('clears the layers', async () => {
    for (let i = 0; i < layersArray.length; ++i) {
      await layersService.remove(layersArray[i]._id)
    }
    layersArray = await layersService.find()
    expect(layersArray.length === 0)
  })

  it('removes the test user', async () => {
    await userService.remove(userObject._id, {
      user: userObject,
      checkAuthorisation: true
    })
    let users = await userService.find({ query: { name: 'test-user' } })
    expect(users.data.length === 0).beTrue()
  })

  // Cleanup
  after(() => {
    if (server) server.close()
    vigicruesStationsService.Model.drop()
    vigicruesObsService.Model.drop()
    layersService.Model.drop()
    userService.Model.drop()
  })
})
