import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'

let fileLayersMixin = {
  mounted () {
    this.$on('globe-ready', _ => {
      this.viewer.extend(Cesium.viewerDragDropMixin, this.options.fileLayers)
      this.viewer.dropError.addEventListener((viewerArg, source, error) => {
        logger.error(error)
      })
      // Required to be aware of the newly added object
      this.viewer.dataSources.dataSourceAdded.addEventListener((collection, source) => {
      	// Check if layer does exist, in this case the source was not added by drop
      	if (this.getCesiumLayerByName(source.name)) return
        // Create an empty layer used as a container
        this.addLayer({
          name: source.name,
          type: 'OverlayLayer',
          icon: 'insert_drive_file',
          cesium: {
            type: 'geoJson',
            isVisible: true,
            arguments: [ source.name ] // Set the data source name instead of URL in this case
          }
        })
      }) 
    })
  }
}

export default fileLayersMixin
