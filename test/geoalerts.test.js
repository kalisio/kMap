import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import spies from 'chai-spies'
import _ from 'lodash'
import moment from 'moment'
import utility from 'util'
import fs from 'fs-extra'
import express from 'express'
import bodyParser from 'body-parser'
import request from 'superagent'
import weacastCore, { weacast } from 'weacast-core'
import weacastGfs from 'weacast-gfs'
import weacastProbe from 'weacast-probe'
import distribution from '@kalisio/feathers-distributed'
import core, { kalisio, hooks } from '@kalisio/kdk-core'
import map, { createFeaturesService } from '../src'

describe('kMap:geoalerts', () => {
  let app, weacastApp, server, port, externalApp, externalServer, externalPort,
    alertService, vigicruesObsService, uService, vService, probeService,
    alertObject, spyRegisterAlert, spyUnregisterAlert, spyCheckAlert
  let activeEventCount = 0
  let eventCount = 0
  let activeWebhookCount = 0
  let webhookCount = 0

  function checkAlertEvent (event) {
    const { alert, triggers } = event
    eventCount++
    if (_.get(alert, 'status.active')) {
      activeEventCount++
      expect(triggers).toExist()
      expect(triggers.length > 0).beTrue()
      expect(triggers[0].geometry).toExist()
    } else {
      expect(triggers).beUndefined()
    }
  }
  function checkAlertWebhook (req, res) {
    const { type, alert, triggers } = req.body
    webhookCount++
    expect(type === 'event').beTrue()
    if (_.get(alert, 'status.active')) {
      activeWebhookCount++
      expect(triggers).toExist()
      expect(triggers.length > 0).beTrue()
      expect(triggers[0].geometry).toExist()
    } else {
      expect(triggers).beUndefined()
    }
    res.sendStatus(200)
  }

  function resetAlertEvent () {
    activeEventCount = 0
    eventCount = 0
  }
  function resetAlertWebhook () {
    activeWebhookCount = 0
    webhookCount = 0
  }

  before(() => {
    chailint(chai, util)
    chai.use(spies)

    app = kalisio()
    weacastApp = weacast()
    // Distribute services
    app.configure(distribution(app.get('distribution').app))
    weacastApp.configure(distribution(app.get('distribution').weacast))
    // Register log hook
    app.hooks({
      error: { all: hooks.log }
    })
    port = app.get('port')
    return Promise.all([
      app.db.connect(),
      weacastApp.db.connect()
    ])
  })

  it('launch external webhook app', (done) => {
    externalApp = express()
    externalApp.use(bodyParser.json())
    externalPort = port + 1
    // Launch the external server
    externalServer = externalApp.listen(externalPort)
    externalServer.once('listening', _ => {
      // Ensure webhook enpoint responds
      externalApp.post('/webhook', checkAlertWebhook)
      request.post('http://localhost:' + externalPort + '/webhook', { type: 'event' }, (error, res, body) => {
        resetAlertWebhook()
        done(error)
      })
    })
  })
  // Let enough time to process
    .timeout(5000)

  it('registers the weacast services', async () => {
    weacastApp.configure(weacastCore)
    await weacastApp.configure(weacastGfs)
    weacastApp.configure(weacastProbe)
    uService = weacastApp.getService('gfs-world/u-wind')
    expect(uService).toExist()
    vService = weacastApp.getService('gfs-world/v-wind')
    expect(vService).toExist()
    probeService = weacastApp.getService('probes')
    expect(probeService).toExist()
  })
  // Let enough time to process
    .timeout(5000)

  it('registers the alert service', (done) => {
    app.configure(core)
    app.configure(map)
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

  it('performs weather element download process', async () => {
    // download both elements in parallel
    await Promise.all([
      uService.updateForecastData(),
      vService.updateForecastData()
    ])
  })
  // Let enough time to download a couple of data
    .timeout(60000)

  it('creates weather active alert at specific location', async () => {
    const now = moment.utc()
    alertObject = await alertService.create({
      cron: '*/5 * * * * *',
      expireAt: now.clone().add({ days: 1 }),
      period: {
        start: { hours: -6 },
        end: { hours: 6 }
      },
      forecast: 'gfs-world',
      elements: ['u-wind', 'v-wind', 'windSpeed'],
      conditions: {
        geometry: {
          type: 'Point',
          coordinates: [144.29091388888889, -5.823011111111111]
        },
        windSpeed: { $gte: 0 } // Set a large range so that we are sure it will trigger
      },
      webhook: {
        url: 'http://localhost:' + externalPort + '/webhook',
        type: 'event'
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.at.least(2)
    spyCheckAlert.reset()
    expect(eventCount).to.be.at.least(2)
    expect(activeEventCount).to.be.at.least(2)
    expect(webhookCount).to.be.at.least(2)
    expect(activeWebhookCount).to.be.at.least(2)
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

  it('removes active weather alert at specific location', async () => {
    await alertService.remove(alertObject._id.toString())
    expect(spyUnregisterAlert).to.have.been.called.once
    spyUnregisterAlert.reset()
    resetAlertEvent()
    resetAlertWebhook()
    const results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(0)
    // Wait long enough to be sure the cron has not been called again (alert unregistered)
    await utility.promisify(setTimeout)(5000)
    expect(spyCheckAlert).to.not.have.been.called()
    spyCheckAlert.reset()
  })
  // Let enough time to process
    .timeout(10000)

  it('creates inactive weather alert at specific location', async () => {
    const now = moment.utc()
    alertObject = await alertService.create({
      cron: '*/5 * * * * *',
      expireAt: now.clone().add({ days: 1 }),
      period: {
        start: { hours: -6 },
        end: { hours: 6 }
      },
      forecast: 'gfs-world',
      elements: ['u-wind', 'v-wind', 'windSpeed'],
      conditions: {
        geometry: {
          type: 'Point',
          coordinates: [144.29091388888889, -5.823011111111111]
        },
        windSpeed: { $lt: -10 } // Set an invalid range so that we are sure it will not trigger
      },
      webhook: {
        url: 'http://localhost:' + externalPort + '/webhook',
        type: 'event'
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.at.least(2)
    spyCheckAlert.reset()
    expect(eventCount).to.be.at.least(2)
    expect(activeEventCount).to.equal(0)
    expect(webhookCount).to.be.at.least(2)
    expect(activeWebhookCount).to.equal(0)
    results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    expect(results[0].status).toExist()
    expect(results[0].status.active).beFalse()
    expect(results[0].status.triggeredAt).beUndefined()
    expect(results[0].status.checkedAt).toExist()
  })
  // Let enough time to process
    .timeout(15000)

  it('removes inactive weather alert at specific location', async () => {
    await alertService.remove(alertObject._id.toString())
    expect(spyUnregisterAlert).to.have.been.called.once
    spyUnregisterAlert.reset()
    resetAlertEvent()
    resetAlertWebhook()
    const results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(0)
    // Wait long enough to be sure the cron has not been called again (alert unregistered)
    await utility.promisify(setTimeout)(5000)
    expect(spyCheckAlert).to.not.have.been.called()
    spyCheckAlert.reset()
  })
  // Let enough time to process
    .timeout(10000)

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
      },
      webhook: {
        url: 'http://localhost:' + externalPort + '/webhook',
        type: 'event'
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.at.least(2)
    spyCheckAlert.reset()
    expect(eventCount).to.be.at.least(2)
    expect(activeEventCount).to.be.at.least(2)
    expect(webhookCount).to.be.at.least(2)
    expect(activeWebhookCount).to.be.at.least(2)
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
    resetAlertWebhook()
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
      },
      webhook: {
        url: 'http://localhost:' + externalPort + '/webhook',
        type: 'event'
      }
    })
    expect(spyRegisterAlert).to.have.been.called.once
    spyRegisterAlert.reset()
    let results = await alertService.find({ paginate: false, query: {} })
    expect(results.length).to.equal(1)
    // Wait long enough to be sure the cron has been called twice
    await utility.promisify(setTimeout)(10000)
    expect(spyCheckAlert).to.have.been.called.at.least(2)
    spyCheckAlert.reset()
    expect(eventCount).to.be.at.least(2)
    expect(activeEventCount).to.equal(0)
    expect(webhookCount).to.be.at.least(2)
    expect(activeWebhookCount).to.equal(0)
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
    resetAlertWebhook()
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
    if (externalServer) await externalServer.close()
    if (server) await server.close()
    await weacastApp.getService('forecasts').Model.drop()
    await probeService.Model.drop()
    await uService.Model.drop()
    await vService.Model.drop()
    await weacastApp.db.disconnect()
    fs.removeSync(app.get('forecastPath'))
    await vigicruesObsService.Model.drop()
    alertService.removeAllListeners()
    await alertService.Model.drop()
    await app.db.disconnect()
  })
})
