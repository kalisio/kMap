import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'
import { Store } from 'kCore/client'

let geojsonLayersMixin = {
  methods: {
    addGeoJson (geojson, name, geojsonOptions) {
      const options = geojsonOptions || this.getGeoJsonOptions()

      return Cesium.GeoJsonDataSource.load(geojson, options)
      .then(dataSource => {
        return this.viewer.dataSources.add(dataSource)
      })
      .otherwise(error => {
        logger.error(error)
      })
    },
    addGeoJsonCluster (geojson, name, geojsonOptions) {
      const options = geojsonOptions || this.getGeoJsonOptions()
      
      return Cesium.GeoJsonDataSource.load(geojson, options)
      .then(dataSource => {
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
        dataSource.clustering.clusterEvent.addEventListener((entities, cluster) => {
          // Custom defined function in component ?
          if (typeof this.getFeatureStyle === 'function') {
            const style = this.getFeatureStyle(cluster, entities)
            // Loop over possible styles
            ['billboard', 'label', 'point'].forEach(type => {
              if (_.has(cluster, type)) {
                _.assign(cluster[type], style[type])
              }
            })
          } else {
            // Loop over possible styles
            ['billboard', 'label', 'point'].forEach(type => {
              if (_.has(cluster, type)) {
                _.assign(cluster[type], { show: true })
              }
            })
          }
        })
        return this.viewer.dataSources.add(dataSource)
      })
      .otherwise(error => {
        logger.error(error)
      })
    },
    convertFromSimpleStyleSpec(options) {
      _.forOwn(options, (value, key) => {
        // Convert to camelCase as required by cesium
        const camelKey = _.camelCase(key)
        if (camelKey !== key) {
          options[camelKey] = value
          delete options[key]
        }
        // Convert from string to color object as required by cesium
        if (['markerColor', 'fill', 'stroke'].includes(key)) {
          options[key] = Cesium.Color.fromCssColorString(value)
        }
      })

      return options
    },
    getGeoJsonOptions () {
      let geojsonOptions = this.options.featureStyle || {}
      
      return convertFromSimpleStyleSpec(geojsonOptions)
    }
  }
}

Store.set('mixins.globe.geojsonLayers', geojsonLayersMixin)

export default geojsonLayersMixin
