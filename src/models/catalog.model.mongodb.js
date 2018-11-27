module.exports = function (app, options) {
  let db = options.db || app.db
  options.Model = db.collection('catalog')
  // Use compound index to have unique pairs scope/value
  options.Model.createIndex({ name: 1 }, { unique: true })
}
