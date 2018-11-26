import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'

let geojsonLayersMixin = {
  methods: {
    async createCesiumGeoJsonLayer (options) {
      const cesiumOptions = options.cesium
      // Check for valid type
      if (cesiumOptions.type !== 'geoJson') return
      // Check for layer options object, create if required
      if (!_.has(cesiumOptions, 'arguments[1]')) _.set(cesiumOptions, 'arguments[1]', {})
      let layerOptions = _.get(cesiumOptions, 'arguments[1]')
      // Merge generic GeoJson options and layer options
      let geoJsonOptions = this.getGeoJsonOptions(options)
      Object.keys(geoJsonOptions).forEach(key => {
        // If layer provided do not override
        if (!_.has(layerOptions, key)) layerOptions[key] = geoJsonOptions[key]
      })
      this.convertFromSimpleStyleSpec(layerOptions)

      try {
        let dataSource = _.get(cesiumOptions, 'arguments[0]')
        // Check if data source already added to the scene and we only want to
        // create a layer on top of it or if we have to load it
        for (let i = 0; i < this.viewer.dataSources.length; i++) {
          if (this.viewer.dataSources.get(i).name === dataSource) {
            dataSource = this.viewer.dataSources.get(i)
            this.viewer.dataSources.remove(dataSource, false)
            break
          }
        }
        if (typeof dataSource === 'string') dataSource = await Cesium.GeoJsonDataSource.load(dataSource, layerOptions)
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
          let entityTypes = ['billboard', 'label', 'point', 'polyline', 'polygon']
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
    convertFromSimpleStyleSpec (style) {
      _.forOwn(style, (value, key) => {
        // Convert to camelCase as required by cesium
        const camelKey = _.camelCase(key)
        if (camelKey !== key) {
          style[camelKey] = value
          delete style[key]
        }
        // Convert from string to color object as required by cesium
        if (['markerColor', 'fill', 'stroke'].includes(camelKey)) {
          style[camelKey] = Cesium.Color.fromCssColorString(value)
        }
      })

      return style
    },
    getGeoJsonOptions (options) {
      return this.options.featureStyle || {}
    }
  },
  created () {
    this.registerCesiumConstructor(this.createCesiumGeoJsonLayer)
  }
}

export default geojsonLayersMixin
