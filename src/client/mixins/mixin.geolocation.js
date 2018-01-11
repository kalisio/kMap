import logger from 'loglevel'
import { Events } from 'quasar'
import { Store, utils } from 'kCore/client'

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
          }, (error) => reject(error), { timeout: 20000, enableHighAccuracy: true })
        }))
      }
      return this.geolocation
    },
    updatePosition () {
      // Get the position
      this.refreshPosition()
      .then(position => {
        const user = Store.get('user')
        if (user) {
          Store.set('user.position', position)
        }
        logger.debug('New user position: ', position)
      })
      .catch(error => {
        Events.$emit('error', error)
        throw error
      })
    }
  },
  created () {
    this.updatePosition()
    // Whenever the user is updated, update position as well
    Events.$on('user-changed', this.updatePosition)
  },
  beforeDestroy() {
    Events.$off('user-changed', this.updatePosition)
  }
}

export default geolocationMixin
