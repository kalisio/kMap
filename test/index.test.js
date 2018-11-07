import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import path from 'path'
import fs from 'fs-extra'
import core, { kalisio, permissions } from '@kalisio/kdk-core'
import map, { permissions as mapPermissions } from '../src'

const modelsPath = path.join(__dirname, '..', 'src', 'models')
const servicesPath = path.join(__dirname, '..', 'src', 'services')

describe('kMap', () => {
  let app, server, port, // baseUrl,
    userService, userObject, geocoderService, layersService, layersArray

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
    layersService.Model.drop()
    userService.Model.drop()
  })
})
