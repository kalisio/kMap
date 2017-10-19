import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import { Store } from 'kCore/client'

let fileLayersMixin = {
  mounted () {
    this.$on('globeReady', _ => {
      this.viewer.extend(Cesium.viewerDragDropMixin, this.options.fileLayers)
      this.viewer.dropError.addEventListener( (viewerArg, source, error) => {
        logger.error(error)
      })
    })
  }
}

Store.set('mixins.globe.fileLayers', fileLayersMixin)

export default fileLayersMixin
