import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'
import { Store } from 'kCore/client'
let geojsonLayersMixin = {
  methods: {
    applyStyle(entities) {
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
    applyClusterStyle(entities, cluster) {
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
    addGeoJson (name, geojson, geojsonOptions) {
      const options = (geojsonOptions ? this.convertFromSimpleStyleSpec(geojsonOptions) : this.getGeoJsonOptions())

      return Cesium.GeoJsonDataSource.load(geojson, options)
      .then(dataSource => {
        this.applyStyle(dataSource.entities)
        return this.viewer.dataSources.add(dataSource)
      })
      .otherwise(error => {
        logger.error(error)
      })
    },
    addGeoJsonCluster (name, geojson, geojsonOptions) {
      const options = (geojsonOptions ? this.convertFromSimpleStyleSpec(geojsonOptions) : this.getGeoJsonOptions())

      return Cesium.GeoJsonDataSource.load(geojson, options)
      .then(dataSource => {
        this.applyStyle(dataSource.entities)
        let clusteringOptions = {
          enabled: true,
          pixelRange: 100,
          minimumClusterSize: 3,
          clusterBillboards: true,
          clusterLabels: true,
          clusterPoints: true
        }
        if (options.clustering) {
          _.assign(clusteringOptions, _.omit(options.clustering, ['enabled']))
        }
        _.assign(dataSource.clustering, clusteringOptions)
        dataSource.clustering.clusterEvent.addEventListener(this.applyClusterStyle)
        return this.viewer.dataSources.add(dataSource)
      })
      .otherwise(error => {
        logger.error(error)
      })
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
      let geojsonOptions = this.options.featureStyle || {}

      return this.convertFromSimpleStyleSpec(geojsonOptions)
    }
  }
}

export default geojsonLayersMixin
