import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import spies from 'chai-spies'
import _ from 'lodash'
import moment from 'moment'
import utility from 'util'
import fs from 'fs-extra'
import core, { kalisio, hooks } from '@kalisio/kdk-core'
import map, { createFeaturesService, createGeoAlertsService } from '../src'

describe('kMap:geoalerts', () => {
  let app, server, port, alertService, vigicruesObsService,
    alertObject, spyRegisterAlert, spyUnregisterAlert, spyCheckAlert
  let activeCount = 0
  let eventCount = 0

  function checkAlertEvent (event) {
    const { alert, triggers } = event
    eventCount++
    if (alert.status.active) {
      activeCount++
      expect(triggers).toExist()
      expect(triggers.length > 0).beTrue()
      expect(triggers[0].geometry).toExist()
    } else {
      expect(triggers).beUndefined()
    }
  }

  function resetAlertEvent () {
    activeCount = 0
    eventCount = 0
  }

  before(() => {
    chailint(chai, util)
    chai.use(spies)

    app = kalisio()
    // Register log hook
    app.hooks({
      error: { all: hooks.log }
    })
    port = app.get('port')
    return app.db.connect()
  })

  it('registers the alert service', (done) => {
    app.configure(core)
    app.configure(map)
    // Create a global alert service
    createGeoAlertsService.call(app)
    alertService = app.getService('geoalerts')
    expect(alertService).toExist()
    alertService.on('geoalert', checkAlertEvent)
    spyRegisterAlert = chai.spy.on(alertService, 'registerAlert')
    spyUnregisterAlert = chai.spy.on(alertService, 'unregisterAlert')
    spyCheckAlert = chai.spy.on(alertService, 'checkAlert')
    // Now app is configured launch the server
    server = app.listen(port)
    server.once('listening', _ => done())
  })
  // Let enough time to process
    .timeout(5000)

  it('create and feed the vigicrues observations service', async () => {
    const tomorrow = moment.utc().add(1, 'days')
    // Create the service
    createFeaturesService.call(app, {
      collection: 'vigicrues-observations',
      featureId: 'CdStationH',
      history: 604800
    })
    vigicruesObsService = app.getService('vigicrues-observations')
    expect(vigicruesObsService).toExist()
    // Feed the collection
    const observations = require('./data/vigicrues.observations.json')
    // Update time to tomorrow so that alert will trigger correctly
    await vigicruesObsService.create(observations.map(observation => Object.assign({}, observation, {
      time: moment.utc(observation.time).date(tomorrow.date()).month(tomorrow.month()).year(tomorrow.year())
    })))
  })

  it('creates active alert at specific station', async () => {
    const now = moment.utc()
    alertObject = await alertService.create({
      cron: '*/5 * * * * *',
      expireAt: now.clone().add({ days: 1 }),
      period: {
        start: { hours: 0 },
        end: { hours: 48 }
      },
      service: 'vigicrues-observations',
      feature: 'A282000101',
      conditions: {
        H: { $gte: 0.6 } // Set a large range so that we are sure it will trigger
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.twice
    spyCheckAlert.reset()
    expect(eventCount).to.equal(2)
    expect(activeCount).to.equal(2)
    results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    expect(results[0].status).toExist()
    expect(results[0].status.active).beTrue()
    expect(results[0].status.triggeredAt).toExist()
    expect(results[0].status.checkedAt).toExist()
    expect(results[0].status.triggeredAt.isAfter(now)).beTrue()
    expect(results[0].status.checkedAt.isAfter(results[0].status.triggeredAt)).beTrue()
  })
  // Let enough time to process
  .timeout(15000)

  it('removes active alert at specific station', async () => {
    await alertService.remove(alertObject._id.toString())
    expect(spyUnregisterAlert).to.have.been.called.once
    spyUnregisterAlert.reset()
    resetAlertEvent()
    const results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(0)
    // Wait long enough to be sure the cron has not been called again (alert unregistered)
    await utility.promisify(setTimeout)(5000)
    expect(spyCheckAlert).to.not.have.been.called()
    spyCheckAlert.reset()
  })
  // Let enough time to process
  .timeout(10000)

  it('creates inactive alert at specific station', async () => {
    const now = moment.utc()
    alertObject = await alertService.create({
      cron: '*/5 * * * * *',
      expireAt: now.clone().add({ days: 1 }),
      period: {
        start: { hours: 0 },
        end: { hours: 48 }
      },
      service: 'vigicrues-observations',
      feature: 'A282000101',
      conditions: {
        H: { $lt: -10 } // Set an invalid range so that we are sure it will not trigger
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.twice
    spyCheckAlert.reset()
    expect(eventCount).to.equal(2)
    expect(activeCount).to.equal(0)
    results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    expect(results[0].status).toExist()
    expect(results[0].status.active).beFalse()
    expect(results[0].status.triggeredAt).beUndefined()
    expect(results[0].status.checkedAt).toExist()
  })
  // Let enough time to process
  .timeout(15000)

  it('removes inactive alert at specific station', async () => {
    await alertService.remove(alertObject._id.toString())
    expect(spyUnregisterAlert).to.have.been.called.once
    spyUnregisterAlert.reset()
    resetAlertEvent()
    const results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(0)
    // Wait long enough to be sure the cron has not been called again (alert unregistered)
    await utility.promisify(setTimeout)(5000)
    expect(spyCheckAlert).to.not.have.been.called()
    spyCheckAlert.reset()
  })
  // Let enough time to process
  .timeout(10000)

  // Cleanup
  after(async () => {
    if (server) await server.close()
    await vigicruesObsService.Model.drop()
    alertService.removeAllListeners()
    await alertService.Model.drop()
    await app.db.disconnect()
  })
})
