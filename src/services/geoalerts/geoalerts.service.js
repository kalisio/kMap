import _ from 'lodash'
import moment from 'moment'
import sift from 'sift'
import request from 'superagent'
import { CronJob } from 'cron'
import makeDebug from 'debug'
const debug = makeDebug('kalisio:kMap:geoalerts:service')

// Alert map
let alerts = {}

export default {

  async registerAlert (alert) {
    if (alerts[alert._id.toString()]) return
    debug('Registering new alert ', alert)
    let cronJob = new CronJob(alert.cron, () => this.checkAlert(alert))
    cronJob.start()
    alerts[alert._id.toString()] = cronJob
    await this.checkAlert(alert)
  },

  unregisterAlert (alert) {
    let cronJob = alerts[alert._id.toString()]
    if (!cronJob) return
    debug('Unregistering new alert ', alert)
    cronJob.stop()
    delete alerts[alert._id.toString()]
  },

  async checkWeatherAlert (alert) {
    const now = moment.utc()
    // Retrieve geometry
    const geometry = _.get(alert, 'conditions.geometry')
    // Convert conditions to internal data model
    const conditions = _.mapKeys(_.omit(alert.conditions, ['geometry']), (value, key) => {
      return (alert.elements.includes(key) ? 'properties.' + key : key)
    })
    const probesService = this.app.getService('probes')
    // Perform aggregation over time range
    let query = Object.assign({
      forecastTime: {
        $gte: now.clone().add(_.get(alert, 'period.start', { seconds: 0 })).toDate(),
        $lte: now.clone().add(_.get(alert, 'period.end', { seconds: 24 * 3600 })).toDate()
      },
      geometry: {
        $geoIntersects: {
          $geometry: geometry
        }
      },
      aggregate: false
    })
    let result = await probesService.create({
      forecast: alert.forecast,
      elements: alert.elements
    }, { query })
    
    // Let sift performs condition matching as in this case MongoDB cannot
    return result.features.filter(sift(conditions))
  },

  async checkMeasureAlert (alert) {
    const now = moment.utc()
    // Convert conditions to internal data model
    const conditions = _.mapKeys(alert.conditions, (value, key) => 'properties.' + key)
    const featureService = this.app.getService(alert.service)
    // Perform aggregation over time range
    let query = Object.assign({
      time: {
        $gte: now.clone().add(_.get(alert, 'period.start', { seconds: 0 })).toDate(),
        $lte: now.clone().add(_.get(alert, 'period.end', { seconds: 24 * 3600 })).toDate()
      },
      ['properties.' + featureService.options.featureId]: alert.feature,
    }, conditions)

    let result = await featureService.find({ query })
    return result.features
  },

  async checkAlert (alert) {
    const now = moment.utc()
    debug('Checking alert at ' + now.format(), _.omit(alert, ['status', 'webhook']))
    // First check if still valid
    if (now.isAfter(alert.expireAt)) {
      this.unregisterAlert(alert)
      return
    }
    const results = (alert.feature ? await this.checkMeasureAlert(alert) : await this.checkWeatherAlert(alert))
    // FIXME: check for a specific duration where conditions are met
    const isActive = (results.length > 0)
    const wasActive = _.get(alert, 'status.active')
    // Then update alert status
    let status = {
      active: isActive,
      checkedAt: now
    }
    // If not previously active and it is now add first time stamp
    if (!wasActive && isActive) {
      status.triggeredAt = now
    } else if (wasActive) { // Else keep track of previous trigger time stamp
      status.triggeredAt = _.get(alert, 'status.triggeredAt')
    }
    debug('Alert ' + alert._id.toString() + ' status', status, ' with ' + results.length + ' triggers')
    // Emit event
    let event = { alert }
    if (isActive) event.triggers = results
    const result = await this.patch(alert._id.toString(), { status })
    // Keep track of changes in memory as well
    Object.assign(alert, result)
    this.emit('geoalert', event)
    // If a webhook is configured call it
    const webhook = alert.webhook
    if (webhook) {
      let body = Object.assign({ alert: _.omit(alert, ['webhook']) }, _.omit(webhook, ['url']))
      if (isActive) body.triggers = results
      return request.post(webhook.url, body)
    }
  }
}
