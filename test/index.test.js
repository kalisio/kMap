import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import core, { kalisio } from 'kCore'
import geocoder from '../src'

describe('kMap', () => {
  let app, server, port, // baseUrl,
    userService, authorisationService, geocoderService,
    user1Object

  before(() => {
    chailint(chai, util)

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
    authorisationService = app.getService('authorisations')
    expect(authorisationService).toExist()
    app.configure(geocoder)
    geocoderService = app.getService('geocoder')
    expect(geocoderService).toExist()
    // Now app is configured launch the server
    server = app.listen(port)
    server.once('listening', _ => done())
  })

  it('creates a test user', () => {
    return userService.create({ email: 'test-1@test.org', name: 'test-user-1' }, { checkAuthorisation: true })
    .then(user => {
      user1Object = user
      return userService.find({ query: { 'profile.name': 'test-user-1' }, checkAuthorisation: true })
    })
    .then(users => {
      expect(users.data.length > 0).beTrue()
    })
  })
  // Let enough time to process
  .timeout(5000)

  it('geocode an address', () => {
    let address = '80 chemin des tournesols, 11400 Castelnaudary'
    geocoderService.create({ address: address }, { user: user1Object, checkAuthorisation: true })
    .then(response => {
      expect(response.length === 1).beTrue()
      expect(response[0].latitude).toExist()
      expect(response[0].longitude).toExist()
    })
  })

  // Cleanup
  after(() => {
    if (server) server.close()
    userService.Model.drop()
  })
})
