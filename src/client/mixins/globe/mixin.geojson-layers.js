import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'

let geojsonLayersMixin = {
  methods: {
    async createCesiumRealtimeGeoJsonLayer (dataSource, options) {
      const featureId = _.get(options, 'featureId')
      const cesiumOptions = options.cesium
      const source = _.get(cesiumOptions, 'source')
      let queryInterval
      if (cesiumOptions.queryInterval) queryInterval = cesiumOptions.queryInterval
      // If query interval not given use 2 x refresh interval as default value
      // this ensures we cover last interval if server/client update processes are not in sync
      if (!queryInterval && cesiumOptions.interval) queryInterval = 2 * cesiumOptions.interval
      // Update function to fetch for new data and update Cesium data source
      let initialized = !options.probeService // If no probe reference, nothing to be initialized
      const updateData = async () => {
        if (options.probeService) {
          // If the probe location is given by another service use it on initialization
          if (!initialized) {
            await dataSource.load(this.getProbeFeatures(options), cesiumOptions)
            initialized = true
          }
          // Then get last available measures
          let measureSource = new Cesium.GeoJsonDataSource()
          await measureSource.load(this.getFeatures(options, queryInterval), cesiumOptions)
          // Then merge with probes
          const probes = dataSource.entities.values
          const measures = measureSource.entities.values
          for (let i = 0; i < probes.length; i++) {
            const probe = probes[i]
            const probeProperties = probe.properties
            for (let j = 0; j < measures.length; j++) {
              const measure = measures[j]
              // When we found a measure for a probe we update it
              if (_.get(probeProperties, featureId).getValue() === _.get(measure.properties, featureId).getValue()) {
                probe.properties = measure.properties
                probe.description = measure.description
              }
            }
          }
        } else if (options.service) { // Check for feature service layers only, in this case update in place
          // If no probe reference, nothing to be initialized
          await dataSource.load(this.getFeatures(options, queryInterval), cesiumOptions)
        } else {
          // Assume source is an URL or a promise returning GeoJson
          await dataSource.load(source, cesiumOptions)
        }
      }
      // Required to be aware of the newly added source
      this.viewer.dataSources.dataSourceAdded.addEventListener(async (collection, newSource) => {
        if (newSource === dataSource) {
          // Setup update timer
          dataSource.updateTimer = setInterval(async () => {
            await updateData()
            this.applyStyle(dataSource.entities)
          }, cesiumOptions.interval)
        }
      })
      // Required to be aware of the removed source
      this.viewer.dataSources.dataSourceRemoved.addEventListener((collection, oldSource) => {
        // Remove update timer
        if (oldSource === dataSource) {
          clearTimeout(dataSource.updateTimer)
          dataSource.updateTimer = null
        }
      })
      // Launch first update
      await updateData()
    },
    async createCesiumGeoJsonLayer (options) {
      const cesiumOptions = options.cesium
      // Check for valid type
      if (cesiumOptions.type !== 'geoJson') return
      // Merge generic GeoJson options and layer options
      let geoJsonOptions = this.getGeoJsonOptions(options)
      Object.keys(geoJsonOptions).forEach(key => {
        // If layer provided do not override
        if (!_.has(cesiumOptions, key)) _.set(cesiumOptions, key, geoJsonOptions[key])
      })
      this.convertFromSimpleStyleSpec(cesiumOptions)

      try {
        const source = _.get(cesiumOptions, 'source')
        let dataSource = source
        // Check if data source already added to the scene and we only want to
        // create a layer on top of it or if we have to load it
        // Indeed loading a file by drop makes Cesium load it under the hood
        for (let i = 0; i < this.viewer.dataSources.length; i++) {
          if (this.viewer.dataSources.get(i).name === dataSource) {
            dataSource = this.viewer.dataSources.get(i)
            this.viewer.dataSources.remove(dataSource, false)
            break
          }
        }
        // If we already have a source we simply use it otherwise we create/load it
        if (!dataSource.name) {
          dataSource = new Cesium.GeoJsonDataSource()
          dataSource.notFromDrop = true
          // Check for feature service layers
          if (cesiumOptions.realtime) {
            await this.createCesiumRealtimeGeoJsonLayer(dataSource, options)
          } else {
            // Assume source is an URL or a promise returning GeoJson
            await dataSource.load(source, cesiumOptions)
          }
        }
        this.applyStyle(dataSource.entities)
        if (cesiumOptions.cluster) {
          // Set default cluster options
          _.assign(dataSource.clustering, {
            enabled: true,
            pixelRange: 100,
            minimumClusterSize: 3,
            clusterBillboards: true,
            clusterLabels: true,
            clusterPoints: true
          }, cesiumOptions.cluster)
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
