import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import { Store } from 'kCore/client'
let fileLayersMixin = {
  mounted () {
    this.$on('controls-ready', _ => {
      this.viewer.extend(Cesium.viewerDragDropMixin, this.options.fileLayers)
      this.viewer.dropError.addEventListener((viewerArg, source, error) => {
        logger.error(error)
      })
    })
  }
}

export default fileLayersMixin
