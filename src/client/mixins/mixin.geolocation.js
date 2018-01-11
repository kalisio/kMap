import { Events } from 'quasar'
import { utils } from 'kCore/client'

let geolocationMixin = {
  methods: {
    refreshPosition () {
      // If we are not waiting for or first time
      if (!this.geolocation || !this.geolocation.isPending) {
        // We need to load the position now
        this.geolocation = utils.createQuerablePromise(new Promise(( resolve, reject ) => {
          if (!window.navigator.geolocation) {
            reject(new Error('Geolocation does not seem to be supported on your device or browser'))
            return
          }
          window.navigator.geolocation.getCurrentPosition((position) => {
            let latitude  = position.coords.latitude
            let longitude = position.coords.longitude
            resolve({ latitude, longitude })
          }, (error) => reject(error), { timeout: 10000, enableHighAccuracy: true })
        }))
      }
      return this.geolocation
    }
  },
  created () {
    // Get the position
    this.refreshPosition()
    .catch(error => {
      Events.$emit('error', error)
      throw error
    })
  }
}

export default geolocationMixin
