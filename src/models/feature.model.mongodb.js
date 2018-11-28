module.exports = function (app, options) {
  let db = options.db || app.db
  options.Model = db.collection(options.collection)
  if (options.history) {
  	options.Model.createIndex({ time: 1 }, { expireAfterSeconds: options.history })
  } else {
  	options.Model.createIndex({ time: 1 })
  }
  options.Model.createIndex({ geometry: '2dsphere' })
  if (options.featureId) {
  	options.Model.createIndex({ ['properties.' + options.featureId]: 1 })
  }
}
