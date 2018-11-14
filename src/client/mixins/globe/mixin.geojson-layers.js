import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'

let geojsonLayersMixin = {
  methods: {
    async createCesiumGeoJsonLayer (options) {
      // Check for valid type
      if (options.type !== 'geoJson') return
      let layerOptions = _.get(options, 'arguments[1]', {})
      // Merge generic GeoJson options and layer options
      let geoJsonOptions = this.getGeoJsonOptions()
      Object.keys(geoJsonOptions).forEach(key => {
        // If layer provided do not override
        if (!_.has(layerOptions, key)) layerOptions[key] = geoJsonOptions[key]
      })
      this.convertFromSimpleStyleSpec(layerOptions)

      try {
        let dataSource = await return Cesium.GeoJsonDataSource.load(geojson, options)
        this.applyStyle(dataSource.entities)
        if (layerOptions.cluster) {
          // Set default cluster options
          _.assign(dataSource.clustering, {
            enabled: true,
            pixelRange: 100,
            minimumClusterSize: 3,
            clusterBillboards: true,
            clusterLabels: true,
            clusterPoints: true
          }, layerOptions.cluster)
          dataSource.clustering.clusterEvent.addEventListener(this.applyClusterStyle)
        }
        return dataSource
      } catch (error) {
        logger.error(error)
        return null
      }
    },
    applyStyle (entities) {
      // Custom defined function in component ?
      if (typeof this.getEntityStyle === 'function') {
        for (let i = 0; i < entities.values.length; i++) {
          let entity = entities.values[i]
          const style = this.getEntityStyle(entity)
          // Loop over possible types
          let entityTypes = ['billboard', 'label', 'point']
          entityTypes.forEach(type => {
            if (entity[type]) {
              _.assign(entity[type], style[type])
            }
          })
        }
      }
    },
    applyClusterStyle (entities, cluster) {
      // Custom defined function in component ?
      if (typeof this.getClusterStyle === 'function') {
        const style = this.getClusterStyle(entities, cluster)
        // Loop over possible styles
        let featureTypes = ['billboard', 'label', 'point']
        featureTypes.forEach(type => {
          if (_.has(cluster, type)) {
            _.assign(cluster[type], style[type])
          }
        })
      } else {
        // Loop over possible styles
        let featureTypes = ['billboard', 'label', 'point']
        featureTypes.forEach(type => {
          if (_.has(cluster, type)) {
            _.assign(cluster[type], { show: true })
          }
        })
      }
    },
    convertFromSimpleStyleSpec (options) {
      _.forOwn(options, (value, key) => {
        // Convert to camelCase as required by cesium
        const camelKey = _.camelCase(key)
        if (camelKey !== key) {
          options[camelKey] = value
          delete options[key]
        }
        // Convert from string to color object as required by cesium
        if (['markerColor', 'fill', 'stroke'].includes(camelKey)) {
          options[camelKey] = Cesium.Color.fromCssColorString(value)
        }
      })

      return options
    },
    getGeoJsonOptions () {
      return this.options.featureStyle || {}
    }
  },
  created () {
    this.registerCesiumConstructor(this.createCesiumGeoJsonLayer)
  }
}

export default geojsonLayersMixin
