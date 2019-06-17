import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'
import { fetchGeoJson, CesiumStyleMappings, getTextTable } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    async loadGeoJson (dataSource, geoJson, cesiumOptions) {
      await dataSource.load(geoJson, cesiumOptions)
      // Process specific entities
      const entities = dataSource.entities.values
      let entitiesToAdd = []
      let entitiesToRemove = []
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        const properties = entity.properties.getValue(0)
        // Circles
        const radius = _.get(properties, 'radius')
        const geodesic = _.get(properties, 'geodesic')
        if (radius && geodesic) {
          let stroke = _.has(properties, 'stroke') ?
            Cesium.Color.fromCssColorString(_.get(properties, 'stroke')) :
            dataSource.stroke
          const strokeWidth = _.get(properties, 'stroke-width', dataSource.strokeWidth)
          if (_.has(properties, 'stroke-opaciy')) stroke.alpha = _.get(properties, 'stroke-opaciy')
          let fill = _.has(properties, 'fill') ?
            Cesium.Color.fromCssColorString(_.get(properties, 'fill')) :
            dataSource.fill
          if (_.has(properties, 'fill-opacity')) fill.alpha = _.get(properties, 'fill-opacity')
          let newEntity = {
            id: entity.id,
            position: entity.position.getValue(0),
            name: entity.name,
            description: entity.description.getValue(0),
            properties: entity.properties.getValue(0),
            ellipse: {
              semiMinorAxis: radius,
              semiMajorAxis: radius,
              material: new Cesium.ColorMaterialProperty(fill),
              outlineColor: new Cesium.ConstantProperty(stroke),
              outlineWidth: strokeWidth,
              outline: new Cesium.ConstantProperty(true)
            }
          }
          entitiesToAdd.push(newEntity)
          entitiesToRemove.push(entity)
        }
        // Walls
        const wall = _.get(properties, 'wall')
        if (wall) {
          // TODO
        }
        // Labels
        const text = _.get(properties, 'icon-text')
        if (text) {
          // TODO
        }
      }
      entitiesToRemove.forEach(entity => dataSource.entities.remove(entity))
      entitiesToAdd.forEach(entity => dataSource.entities.add(entity))
    },
    async startRealtimeGeoJsonDataUpdate (dataSource, options) {
      const cesiumOptions = options.cesium
      // If no interval given this is a manual update
      if (!_.has(cesiumOptions, 'interval')) return
      // Setup update timer
      dataSource.updateTimer = setInterval(() => dataSource.updateGeoJson(), cesiumOptions.interval)
      // Launch first update
      await this.updateRealtimeGeoJsonData(dataSource, options)
    },
    stopRealtimeGeoJsonDataUpdate (dataSource) {
      if (!dataSource.updateTimer) return
      clearTimeout(dataSource.updateTimer)
      dataSource.updateTimer = null
    },
    async updateRealtimeGeoJsonData (dataSource, options, geoJson) {
      const featureId = _.get(options, 'featureId')
      const cesiumOptions = options.cesium
      let source = _.get(cesiumOptions, 'source')
      let queryInterval
      if (cesiumOptions.queryInterval) queryInterval = cesiumOptions.queryInterval
      // If query interval not given use 2 x refresh interval as default value
      // this ensures we cover last interval if server/client update processes are not in sync
      if (!queryInterval && cesiumOptions.interval) queryInterval = 2 * cesiumOptions.interval
      // Update function to fetch for new data and update Cesium data source
      if (options.probeService) {
        // If the probe location is given by another service use it on initialization
        if (dataSource.entities.values.length === 0) {
          await this.loadGeoJson(dataSource, this.getProbeFeatures(options), cesiumOptions)
        }
        // Then get last available measures
        let measureSource = new Cesium.GeoJsonDataSource()
        await this.loadGeoJson(measureSource, this.getFeatures(options, queryInterval), cesiumOptions)
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
        await this.loadGeoJson(dataSource, his.getFeatures(options, queryInterval), cesiumOptions)
      } else if (geoJson) {
        await this.loadGeoJson(dataSource, geoJson, cesiumOptions)
      } else if (!_.isNil(source)) {
        // Assume source is an URL returning GeoJson
        await this.loadGeoJson(dataSource, fetchGeoJson(source), cesiumOptions)
      }
    },
    async createCesiumRealtimeGeoJsonLayer (dataSource, options) {
      const cesiumOptions = options.cesium
      // Default is to start fetching except if qe don't have a source => manual update
      const source = _.get(cesiumOptions, 'source')
      const start = _.get(cesiumOptions, 'start', source ? true : false)
      // Add update capabilities
      dataSource.updateGeoJson = async (geoJson) => {
        await this.updateRealtimeGeoJsonData(dataSource, options, geoJson)
        this.applyStyle(dataSource.entities, options)
        if (typeof this.applyTooltips === 'function') this.applyTooltips(dataSource.entities, options)
      }
      // Required to be aware of the removed source
      this.viewer.dataSources.dataSourceRemoved.addEventListener((collection, oldSource) => {
        // Remove update timer
        if (oldSource === dataSource) {
          this.stopRealtimeGeoJsonDataUpdate(dataSource)
        }
      })
      // Launch first update if required
      if (start) await this.startRealtimeGeoJsonDataUpdate(dataSource, options)
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
      // Optimize templating by creating compilers up-front
      let entityStyleTemplate = _.get(cesiumOptions, 'entityStyle.template')
      if (entityStyleTemplate) {
        // We allow to template style properties according to feature, because it can be slow you have to specify a subset of properties
        _.set(cesiumOptions, 'entityStyleTemplate', entityStyleTemplate.map(property => ({
          property, compiler: _.template(_.get(cesiumOptions, `entityStyle.${property}`))
        })))
      }
      const popupTemplate = _.get(cesiumOptions, 'popup.template')
      if (popupTemplate) {
        cesiumOptions.popup.compiler = _.template(popupTemplate)
      }
      const tooltipTemplate = _.get(cesiumOptions, 'tooltip.template')
      if (tooltipTemplate) {
        cesiumOptions.tooltip.compiler = _.template(tooltipTemplate)
      }
      this.convertFromSimpleStyleSpec(cesiumOptions, 'update-in-place')
      // Perform required conversion from JSON to Cesium objects
      // If templating occurs we need to wait until it is performed to convert to Cesium objects
      if (cesiumOptions.entityStyle && !entityStyleTemplate) cesiumOptions.entityStyle = this.convertToCesiumObjects(cesiumOptions.entityStyle)
      if (cesiumOptions.clusterStyle) cesiumOptions.clusterStyle = this.convertToCesiumObjects(cesiumOptions.clusterStyle)
      if (cesiumOptions.tooltip) cesiumOptions.tooltip = this.convertToCesiumObjects(cesiumOptions.tooltip)
      if (cesiumOptions.popup) cesiumOptions.popup = this.convertToCesiumObjects(cesiumOptions.popup)

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
        if (!dataSource || !dataSource.name) {
          dataSource = new Cesium.GeoJsonDataSource()
          dataSource.notFromDrop = true
          // Check for feature service layers
          if (cesiumOptions.realtime) {
            await this.createCesiumRealtimeGeoJsonLayer(dataSource, options)
          } else {
            // Check for feature service layers
            if (options.service) await this.loadGeoJson(dataSource, this.getFeatures(options), cesiumOptions)
            // Assume source is an URL returning GeoJson
            else await this.loadGeoJson(dataSource, fetchGeoJson(source), cesiumOptions)
          }
        }
        this.applyStyle(dataSource.entities, options)
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
          dataSource.clustering.clusterEvent.addEventListener(
            (entities, cluster) => this.applyClusterStyle(entities, cluster, options)
          )
        }
        if (typeof this.applyTooltips === 'function') this.applyTooltips(dataSource.entities, options)
        return dataSource
      } catch (error) {
        logger.error(error)
        return null
      }
    },
    getGeoJsonOptions (options) {
      return this.options.featureStyle || {}
    },
    async updateLayer (name, geoJson) {
      // Retrieve the layer
      const layer = this.getCesiumLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      if (typeof layer.updateGeoJson === 'function') layer.updateGeoJson(geoJson)
    }
  },
  created () {
    this.registerCesiumConstructor(this.createCesiumGeoJsonLayer)
    // Perform required conversion from JSON to Cesium objects
    if (this.options.featureStyle) {
      Object.assign(Cesium.GeoJsonDataSource, this.convertFromSimpleStyleSpec(this.options.featureStyle, 'update-in-place'))
    }
  }
}

export default geojsonLayersMixin
