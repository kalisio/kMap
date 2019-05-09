import Cesium from 'cesium/Source/Cesium.js'
import logger from 'loglevel'
import _ from 'lodash'
import { fetchGeoJson, CesiumStyleMappings, getTextTable } from '../../utils'

let geojsonLayersMixin = {
  methods: {
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
          await dataSource.load(this.getProbeFeatures(options), cesiumOptions)
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
      } else if (geoJson) {
        await dataSource.load(geoJson, cesiumOptions)
      } else if (!_.isNil(source)) {
        // Assume source is an URL returning GeoJson
        await dataSource.load(fetchGeoJson(source), cesiumOptions)
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
        this.applyTooltips(dataSource.entities, options)
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
            if (options.service) await dataSource.load(this.getFeatures(options), cesiumOptions)
            // Assume source is an URL returning GeoJson
            else await dataSource.load(fetchGeoJson(source), cesiumOptions)
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
      let cesiumOptions = options.cesium || options

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
        // Specific case of 3D models that can be used to replace default billboards generated by cesium
        if (style.model && entity.billboard) {
          entity.billboard = undefined
          entity.model = style.model
        }
        // Handle specific case of orientation
        if (style.orientation) entity.orientation = style.orientation
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
          // if (entity.label) {
          this.viewer.entities.add({ parent: entity, position, label: tooltip })
          // }
          // else entity.label = new Cesium.LabelGraphics(tooltip)
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
        let Class = _.get(Cesium, constructor)
        // Can be constant, constructable or callable
        if (typeof Class === 'function') {
          try { return Class(...args) } catch (error) { /* Simply avoid raising any error */ }
          try { return new Class(...args) } catch (error) { /* Simply avoid raising any error */ }
        } else return Class
      }
      const mapValue = (value) => {
        if (typeof value === 'object') {
          const type = value.type
          const options = value.options
          if (type && options) {
            const constructor = type.replace('Cesium.', '')
            if (Array.isArray(options)) return createCesiumObject(constructor, ...this.convertToCesiumObjects(options))
            else return createCesiumObject(constructor, this.convertToCesiumObjects(options))
          } else return this.convertToCesiumObjects(value)
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
      let style = _.merge({}, this.options.entityStyle || {})
      // We allow to template entity style properties according to feature,
      // because it can be slow you have to specify a subset of properties
      const entityStyleTemplate = _.get(cesiumOptions, 'entityStyleTemplate')
      if (entityStyleTemplate) {
        let entityStyle = _.cloneDeep(cesiumOptions.entityStyle)
        entityStyleTemplate.forEach(entry => {
          // Perform templating, set using simple spec mapping first then raw if property not found
          let value = entry.compiler({ properties })
          const property = entry.property
          // Handle specific case of orientation
          if ((property === 'orientation') && entity.position) {
            const localFrameAxes = _.get(entityStyle, 'localFrameAxes', ['east', 'north'])
            const localFrame = Cesium.Transforms.localFrameToFixedFrameGenerator(...localFrameAxes)
            const position = entity.position.getValue(this.viewer.clock.currentTime)
            // From heading, pitch, roll as templated string to quaternion
            value = value.split(',').map(angle => Cesium.Math.toRadians(parseFloat(angle)))
            value = new Cesium.HeadingPitchRoll(...value)
            // Then from local to position frame
            value = Cesium.Transforms.headingPitchRollQuaternion(position, value, Cesium.Ellipsoid.WGS84, localFrame)
          }
          _.set(entityStyle, property, value)
        })
        // In this case we perform conversion to Cesium objects once templating has occured
        style = _.merge(style, this.convertToCesiumObjects(entityStyle))
      } else {
        // In this case the conversion to Cesium objects has already occured on layer creation
        style = _.merge(style, cesiumOptions.entityStyle || {})
      }
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
        let properties = entity.properties.getValue(0)
        let cesiumOptions = options.cesium || options
        let popupStyle = _.merge({}, this.options.popup,
          cesiumOptions.popup, properties.popup)
        // Default content
        let text = popupStyle.text
        // Custom list given ?
        if (!text) {
          if (popupStyle.pick) {
            properties = _.pick(properties, popupStyle.pick)
          } else if (popupStyle.omit) {
            properties = _.omit(properties, popupStyle.omit)
          } else if (popupStyle.template) {
            const compiler = popupStyle.compiler
            text = compiler({ properties })
          }
        }
        // Cesium does not support HTML
        // if (!html) html = getHtmlTable(properties)
        if (!text) text = getTextTable(properties)
        if (!text) return null // Nothing to be displayed
        popup = Object.assign({
          text: text,
          show: true
        }, popupStyle.options)
      }
      return popup
    },
    getDefaultTooltip (entity, options) {
      let tooltip
      if (entity.properties) {
        let properties = entity.properties.getValue(0)
        let cesiumOptions = options.cesium || options
        let tooltipStyle = _.merge({}, this.options.tooltip,
          cesiumOptions.tooltip, properties.tooltip)
        // Default content
        let text = tooltipStyle.text
        if (!text) {
          if (tooltipStyle.property) {
            text = _.get(properties, tooltipStyle.property)
          } else if (tooltipStyle.template) {
            const compiler = tooltipStyle.compiler
            text = compiler({ properties })
          }
        }
        if (text) {
          tooltip = Object.assign({
            text,
            show: (!!_.get(tooltipStyle, 'options.permanent'))
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
      const layer = this.getCesiumLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      if (typeof layer.updateGeoJson === 'function') layer.updateGeoJson(geoJson)
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
