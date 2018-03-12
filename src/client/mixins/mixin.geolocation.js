import logger from 'loglevel'
import { Events, Dialog } from 'quasar'
import { Store, utils } from 'kCore/client'
import { errors } from '../../common'

let geolocationMixin = {
  methods: {
    refreshPosition () {
      // If we are not waiting for or first time
      if (!this.geolocation || !this.geolocation.isPending) {
        // We need to load the position now
        this.geolocation = utils.createQuerablePromise(new Promise((resolve, reject) => {
          if (!window.navigator.geolocation) {
            reject(new Error('Geolocation does not seem to be supported on your device or browser'))
            return
          }
          window.navigator.geolocation.getCurrentPosition((position) => {
            let latitude = position.coords.latitude
            let longitude = position.coords.longitude
            resolve({ latitude, longitude })
          }, (error) => reject(error), { timeout: 30000, enableHighAccuracy: true })
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
        const code = error.code
        let message = this.$t('mixins.geolocation.ERROR_MESSAGE')
        if (code === error.PERMISSION_DENIED) {
          message += '<br>'
          message += this.$t('mixins.geolocation.PERMISSION_DENIED_MESSAGE')
        } else if (code === error.POSITION_UNAVAILABLE) {
          message += '<br>'
          message += this.$t('mixins.geolocation.POSITION_UNAVAILABLE_MESSAGE')
        } else if (code === error.TIMEOUT) {
          message += '<br>'
          message += this.$t('mixins.geolocation.POSITION_TIMEOUT_MESSAGE')
        }
        // It seems there is no message when a code is present, however we cannot alter the original error
        // with the new message because it is a read-only property so we clone it
        error = new errors.KPositionError(message)
        Dialog.create({
          title: this.$t('mixins.geolocation.ERROR_MESSAGE'),
          message: this.$t('mixins.geolocation.DIALOG_MESSAGE'),
          buttons: [
            {
              label: 'Dismiss',
              handler: () => {
                // This will dispatch/display the error message
                Events.$emit('error', error)
                throw error
              }
            },
            {
              label: 'Retry',
              handler: () => this.updatePosition()
            }
          ]
        })
      })
    }
  },
  created () {
    this.updatePosition()
    // Whenever the user is updated, update position as well
    Events.$on('user-changed', this.updatePosition)
  },
  beforeDestroy () {
    Events.$off('user-changed', this.updatePosition)
  }
}

export default geolocationMixin
