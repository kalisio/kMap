import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'
import { CesiumStyleMappings, getTextTable } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    async startRealtimeGeoJsonDataUpdate (dataSource, options) {
      const cesiumOptions = options.cesium
      // Setup update timer
      dataSource.updateTimer = setInterval(async () => {
        await this.updateRealtimeGeoJsonData(dataSource, options)
        this.applyStyle(dataSource.entities, options)
        this.applyTooltips(dataSource.entities, options)
      }, cesiumOptions.interval)
      // Launch first update
      await this.updateRealtimeGeoJsonData(dataSource, options)
    },
    stopRealtimeGeoJsonDataUpdate (dataSource) {
      if (!dataSource.updateTimer) return
      clearTimeout(dataSource.updateTimer)
      dataSource.updateTimer = null
    },
    async updateRealtimeGeoJsonData (dataSource, options, geoJson) {
      const cesiumOptions = options.cesium
      const source = _.get(cesiumOptions, 'source')
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
      } else if (source || geoJson) {
        // Assume source is an URL or a promise returning GeoJson
        await dataSource.load(geoJson ? geoJson : source, cesiumOptions)
      }
    },
    async createCesiumRealtimeGeoJsonLayer (dataSource, options) {
      const featureId = _.get(options, 'featureId')
      const cesiumOptions = options.cesium
      const source = _.get(cesiumOptions, 'source')
      const start = _.get(cesiumOptions, 'start', true) // Default is to start fetching
      let queryInterval
      if (cesiumOptions.queryInterval) queryInterval = cesiumOptions.queryInterval
      // If query interval not given use 2 x refresh interval as default value
      // this ensures we cover last interval if server/client update processes are not in sync
      if (!queryInterval && cesiumOptions.interval) queryInterval = 2 * cesiumOptions.interval
      // Update function to fetch for new data and update Cesium data source
      let initialized = !options.probeService // If no probe reference, nothing to be initialized
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
      this.convertFromSimpleStyleSpec(cesiumOptions, 'update-in-place')
      // Perform required conversion from JSON to Cesium objects
      if (cesiumOptions.entityStyle) cesiumOptions.entityStyle = this.convertToCesiumObjects(cesiumOptions.entityStyle)
      if (cesiumOptions.clusterStyle) cesiumOptions.clusterStyle = this.convertToCesiumObjects(cesiumOptions.clusterStyle)
      if (cesiumOptions.tooltip) cesiumOptions.tooltip = this.convertToCesiumObjects(cesiumOptions.tooltip)

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
            // Assume source is an URL or a promise returning GeoJson
            await dataSource.load(source, cesiumOptions)
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
        this.applyTooltips(dataSource.entities, options)
        return dataSource
      } catch (error) {
        logger.error(error)
        return null
      }
    },
    applyStyle (entities, options) {
      for (let i = 0; i < entities.values.length; i++) {
        let entity = entities.values[i]
        const style = this.generateCesiumStyle('entityStyle', entity, options)
        // Loop over possible types
        const entityTypes = ['billboard', 'label', 'point', 'polyline', 'polygon']
        entityTypes.forEach(type => {
          if (entity[type]) {
            _.merge(entity[type], style[type])
          }
        })
      }
    },
    applyClusterStyle (entities, cluster, options) {
      const style = this.generateCesiumStyle('clusterStyle', entities, cluster, options)
      // Loop over possible styles
      const featureTypes = ['billboard', 'label', 'point']
      featureTypes.forEach(type => {
        if (_.has(cluster, type)) {
          _.merge(cluster[type], style[type])
        }
      })
    },
    applyTooltips (entities, options) {
      for (let i = 0; i < entities.values.length; i++) {
        let entity = entities.values[i]
        const tooltip = this.generateCesiumStyle('tooltip', entity, options)
        if (tooltip) {
          const position = this.getPositionForEntity(entity)
          // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child
          // Similarly ff entity already has a label we need a separated entity anyway
          //if (entity.label) {
            this.viewer.entities.add({ parent: entity, position, label: tooltip })
          //}
          //else entity.label = new Cesium.LabelGraphics(tooltip)
        }
      }
    },
    convertFromSimpleStyleSpec (style, inPlace = false) {
      if (!style) return {}
      let convertedStyle = (inPlace ? style : {})
      _.forOwn(style, (value, key) => {
        if (_.has(CesiumStyleMappings, key)) {
          const mapping = _.get(CesiumStyleMappings, key)
          _.set(convertedStyle, mapping, value)
          if (inPlace) _.unset(style, key)
          // Convert from string to color object as required by cesium
          if ((typeof value === 'string') && ['markerColor', 'fill', 'stroke'].includes(mapping)) {
            _.set(convertedStyle, mapping, Cesium.Color.fromCssColorString(value))
          }
        }
      })
      return convertedStyle
    },
    convertToCesiumObjects (style) {
      // Helper to convert from string to objects
      function createCesiumObject () {
        let args = Array.from(arguments)
        const constructor = args[0]
        args.shift()
        let object = _.get(Cesium, constructor)
        // Can be constant, constructable or callable
        if (typeof object === 'function') {
          try { return object(...args) }
          catch (error) { /* Simply avoid raising any error */ }
          try { return new object(...args) } catch (error) { /* Simply avoid raising any error */ }
        } else return object
      }
      const mapValue = (value) => {
        if (typeof value === 'object') {
          const type = value.type
          const options = value.options
          if (type && options) {
            const constructor = type.replace('Cesium.', '')
            if (Array.isArray(options)) return createCesiumObject(constructor, ...this.convertToCesiumObjects(options))
            else return createCesiumObject(constructor, this.convertToCesiumObjects(options))
          }
          else return this.convertToCesiumObjects(value)
        } else if (typeof value === 'string') {
          if (value.startsWith('Cesium.')) {
            const constructor = value.replace('Cesium.', '')
            return createCesiumObject(constructor)
          }
        }
        return value
      }
      if (Array.isArray(style)) return style.map(mapValue)
      else return _.mapValues(style, mapValue)
    },
    registerCesiumStyle (type, generator) {
      this[type + 'Factory'].push(generator)
    },
    unregisterCesiumStyle (type, generator) {
      _.pull(this[type + 'Factory'], generator)
    },
    generateCesiumStyle () {
      let args = Array.from(arguments)
      const type = args[0]
      args.shift()
      let style
      // Iterate over all registered generators until we find one
      // Last registered overrides previous ones (usefull to override default styles)
      for (let i = this[type + 'Factory'].length - 1; i >= 0; i--) {
        const generator = this[type + 'Factory'][i]
        style = generator(...args)
        if (style) break
      }
      return style
    },
    getDefaultEntityStyle (entity, options) {
      const properties = (entity.properties ? entity.properties.getValue(0) : null)
      let cesiumOptions = options.cesium || options
      let style = _.merge({},
        this.options.entityStyle || {},
        cesiumOptions.entityStyle || {})
      // We allow to template style properties according to feature properties, because it can be slow on large we have an option
      if (cesiumOptions.templateStyle) style = templateObject({ properties }, style)
      return style
    },
    getDefaultClusterStyle (entities, cluster, options) {
      let cesiumOptions = options.cesium || options
      let style = _.merge({},
        this.options.clusterStyle || {},
        cesiumOptions.clusterStyle || {})
      // Look for templated options
      if (_.has(style, 'label.text')) {
        let compiler = _.template(_.get(style, 'label.text'))
        // To avoid erasing of initial value due to reference, duplicate
        let labelStyle = _.cloneDeep(_.get(style, 'label'))
        _.set(labelStyle, 'text', compiler({ entities, cluster }))
        _.set(style, 'label', labelStyle)
      }
      return style
    },
    getDefaultPopup (entity, options) {
      let popup
      if (entity.properties) {
        let cesiumOptions = options.cesium || options
        let popupStyle = _.merge({},
          this.options.popup || {},
          cesiumOptions.popup || {})
        // Default content
        let properties = entity.properties.getValue(0)
        // Custom list given ?
        if (popupStyle) {
          if (popupStyle.pick) {
            properties = _.pick(properties, popupStyle.pick)
          } else if (popupStyle.omit) {
            properties = _.omit(properties, popupStyle.omit)
          }
        }
        // Cesium does not support HTML
        //let html = getHtmlTable(properties)
        let text = getTextTable(properties)
        popup = Object.assign({
          text: text,
          show : true,
        }, popupStyle.options)
      }
      return popup
    },
    getDefaultTooltip (entity, options) {
      let tooltip
      if (entity.properties) {
        let cesiumOptions = options.cesium || options
        let tooltipStyle = _.merge({},
          this.options.tooltip || {},
          cesiumOptions.tooltip || {})
        // Default content
        let properties = entity.properties.getValue(0)
        let html
        if (tooltipStyle.property) {
          html = (_.has(properties, tooltipStyle.property)
          ? _.get(properties, tooltipStyle.property) : _.get(feature, tooltipStyle.property))
        } else if (tooltipStyle.template) {
          let compiler = _.template(tooltipStyle.template)
          html = compiler({ properties, feature })
        }
        if (html) {
          tooltip = Object.assign({
            text: html,
            show : (tooltipStyle.permanent ? true : false)
          }, tooltipStyle.options)
        }
      }
      return tooltip
    },
    getGeoJsonOptions (options) {
      return this.options.featureStyle || {}
    },
    getNbChildrenForEntity (entity) {
      if (entity._children) return entity._children.length
      else return 0
    },
    getChildForEntity (entity, index) {
      if (this.getNbChildrenForEntity(entity) > 0) return entity._children[index || 0]
    },
    getPositionForEntity (entity) {
      let position = entity.position
      if (!position) {
        if (entity.polygon) {
          position = Cesium.BoundingSphere.fromPoints(entity.polygon.positions.getValue()).center
        } else if (entity.polyline) {
          position = Cesium.BoundingSphere.fromPoints(entity.polyline.positions.getValue()).center
        }
        Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(position, position)
      }
      return position
    },
    isTooltipOpen (entity) {
      if (entity.label) return entity.label.show
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) return this.isTooltipOpen(this.getChildForEntity(entity))
      else return false
    },
    openTooltip (entity) {
      if (entity.label) entity.label.show = true
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) this.openTooltip(this.getChildForEntity(entity))
    },
    closeTooltip (entity) {
      if (entity.label) entity.label.show = false
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) this.closeTooltip(this.getChildForEntity(entity))
    },
    onTooltip (options, event) {
      // Nothing to do in this case
      if (options && _.get(options, 'cesium.tooltip.permanent)')) return
      // FIXME: show/hide tooltip
      const entity = event.target
      if (this.overEntity) {
        this.closeTooltip(this.overEntity)
        this.overEntity = null
      }
      // Only for entities from a layer
      if (options && entity) {
        this.overEntity = entity
        this.openTooltip(this.overEntity)
      }
    },
    onPopup (options, event) {
      const entity = event.target
      // Close previous if any (but not when clicking on the popup itself)
      if (this.popupEntity) {
        this.viewer.entities.remove(this.popupEntity)
        this.popupEntity = null
      }
      // Do not reopen on same entity clicked
      if (this.clickedEntity === entity) {
        this.clickedEntity = null
      } else {
        this.clickedEntity = entity
      }
      // Only for entities from a layer
      if (!this.clickedEntity || !options) return
      const popup = this.generateCesiumStyle('popup', this.clickedEntity, options)
      if (popup) {
        const position = this.getPositionForEntity(this.clickedEntity)
        this.popupEntity = this.viewer.entities.add({ position, label: popup })
      }
    },
    async updateLayer (name, geoJson) {
      // Retrieve the layer
      const layer = this.getLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      const dataSource = this.getCesiumLayerByName(name)
      if (!dataSource) return // Cannot update invisible layer
      if (typeof dataSource.load === 'function') {
        await this.updateRealtimeGeoJsonData(dataSource, layer, geoJson)
        this.applyStyle(dataSource.entities, layer)
        this.applyTooltips(dataSource.entities, layer)
      }
    }
  },
  created () {
    this.entityStyleFactory = []
    this.clusterStyleFactory = []
    this.tooltipFactory = []
    this.popupFactory = []
    this.registerCesiumStyle('entityStyle', this.getDefaultEntityStyle)
    this.registerCesiumStyle('clusterStyle', this.getDefaultClusterStyle)
    this.registerCesiumStyle('tooltip', this.getDefaultTooltip)
    this.registerCesiumStyle('popup', this.getDefaultPopup)
    this.registerCesiumConstructor(this.createCesiumGeoJsonLayer)
    // Perform required conversion from JSON to Cesium objects
    if (this.options.entityStyle) this.options.entityStyle = this.convertToCesiumObjects(this.options.entityStyle)
    if (this.options.clusterStyle) this.options.clusterStyle = this.convertToCesiumObjects(this.options.clusterStyle)
    if (this.options.tooltip) this.options.tooltip = this.convertToCesiumObjects(this.options.tooltip)
    if (this.options.popup) this.options.popup = this.convertToCesiumObjects(this.options.popup)
    // Default feature styling
    if (this.options.featureStyle) {
      Object.assign(Cesium.GeoJsonDataSource, this.convertFromSimpleStyleSpec(this.options.featureStyle, 'update-in-place'))
    }
  },
  mounted () {
    this.$on('mousemove', this.onTooltip)
    this.$on('click', this.onPopup)
  },
  beforeDestroy () {
    this.$off('mousemove', this.onTooltip)
    this.$off('click', this.onPopup)
  }
}

export default geojsonLayersMixin
