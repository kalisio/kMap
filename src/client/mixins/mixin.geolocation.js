import logger from 'loglevel'
import { Events, Toast } from 'quasar'
import { Store, utils } from '@kalisio/kdk-core/client'

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
    async updatePosition () {
      // Get the position
      try {
        const position = await this.refreshPosition()
        const user = Store.get('user')
        if (user) {
          Store.set('user.position', position)
        }
        logger.debug('New user position: ', position)
      } catch (error) {
        const code = error.code
        let message = this.$t('mixins.geolocation.ERROR_MESSAGE')
        if (code === error.PERMISSION_DENIED) {
          message += '</br>'
          message += this.$t('mixins.geolocation.PERMISSION_DENIED_MESSAGE')
        } else if (code === error.POSITION_UNAVAILABLE) {
          message += '</br>'
          message += this.$t('mixins.geolocation.POSITION_UNAVAILABLE_MESSAGE')
        } else if (code === error.TIMEOUT) {
          message += '</br>'
          message += this.$t('mixins.geolocation.POSITION_TIMEOUT_MESSAGE')
        }
        // It seems there is no message when a code is present, however we cannot alter the original error
        // with the new message because it is a read-only property so we clone it
        Toast.create.negative({
          html: message,
          timeout: 10000,
          button: {
            label: this.$t('mixins.geolocation.POSITION_RETRY_BUTTON'),
            handler: () => {
              this.updatePosition()
            }
          }
        })
      }
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
