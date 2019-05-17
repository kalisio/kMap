import Cesium from 'cesium/Source/Cesium.js'
import _ from 'lodash'
import { CesiumStyleMappings } from '../../utils'

let styleMixin = {
  methods: {
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
      if (properties && properties.entityStyle) _.merge(style, this.convertToCesiumObjects(properties.entityStyle))
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
    }
  },
  created () {
    this.entityStyleFactory = []
    this.clusterStyleFactory = []
    this.registerCesiumStyle('entityStyle', this.getDefaultEntityStyle)
    this.registerCesiumStyle('clusterStyle', this.getDefaultClusterStyle)
    // Perform required conversion from JSON to Cesium objects
    if (this.options.entityStyle) this.options.entityStyle = this.convertToCesiumObjects(this.options.entityStyle)
    if (this.options.clusterStyle) this.options.clusterStyle = this.convertToCesiumObjects(this.options.clusterStyle)
  }
}

export default styleMixin
