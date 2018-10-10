import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import core, { kalisio, permissions } from '@kalisio/kCore'
import map, { permissions as mapPermissions } from '../src'

describe('kMap', () => {
  let app, server, port, // baseUrl,
    userService, userObject, geocoderService

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
    // Now app is configured launch the server
    server = app.listen(port)
    server.once('listening', _ => done())
  })
  // Let enough time to process
  .timeout(5000)

  it('creates a test user', () => {
    return userService.create({ email: 'test-user@test.org', name: 'test-user' }, { checkAuthorisation: true })
    .then(user => {
      userObject = user
      return userService.find({ query: { 'profile.name': 'test-user' }, user: userObject, checkAuthorisation: true })
    })
    .then(users => {
      expect(users.data.length > 0).beTrue()
    })
  })
  // Let enough time to process
  .timeout(5000)

  it('geocode an address', () => {
    let address = '80 chemin des tournesols, 11400 Castelnaudary'
    geocoderService.create({ address: address }, { user: userObject, checkAuthorisation: true })
    .then(response => {
      expect(response.length === 1).beTrue()
      expect(response[0].latitude).toExist()
      expect(response[0].longitude).toExist()
    })
  })

  it('removes the test user', () => {
    return userService.remove(userObject._id, {
      user: userObject,
      checkAuthorisation: true
    })
    .then(user => {
      return userService.find({ query: { name: 'test-user' } })
    })
    .then(users => {
      expect(users.data.length === 0).beTrue()
    })
  })
  // Let enough time to process
  .timeout(5000)

  // Cleanup
  after(() => {
    if (server) server.close()
    userService.Model.drop()
  })
})
