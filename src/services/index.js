import path from 'path'
const servicesPath = path.join(__dirname, '..', 'services')

module.exports = async function () {
  const app = this

  app.createService('geocoder', { servicesPath })
}
