import L from 'leaflet'
import _ from 'lodash'
import logger from 'loglevel'
import 'leaflet-realtime'
import { fetchGeoJson, LeafletEvents, LeafletStyleMappings, bindLeafletEvents, getHtmlTable } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    processRealtimeGeoJsonLayerOptions (options) {
      let leafletOptions = options.leaflet || options
      // Alter type as required by the plugin
      leafletOptions.type = 'realtime'
      // We first need to create an underlying container or setup Id function
      const id = _.get(options, 'featureId', _.get(leafletOptions, 'id', '_id'))
      if (id) _.set(leafletOptions, 'getFeatureId', (feature) => _.get(feature, 'properties.' + id, _.get(feature, id)))
      let container = _.get(leafletOptions, 'container')
      if (container) {
        leafletOptions.container = this.createLeafletLayer({ type: container })
      }
      // Custom update function to ensure dynamic styling works as expected
      if (!_.has(leafletOptions, 'updateFeature')) {
        leafletOptions.updateFeature = function (feature, oldLayer) {
          // A new feature is coming, create it
          if (!oldLayer) return
          // An existing one is found, simply update styling, etc.
          leafletOptions.onEachFeature(feature, oldLayer)
          if (oldLayer.setStyle) {
            // Some vector layers can be used for points, eg circleMarker,
            // in this case we use marker styling instead of lines/polygons styling
            if (feature.geometry.type === 'Point') {
              // FIXME: updating style in place does not seem to work, so for now we recreate the whole marker
              //oldLayer.setStyle(leafletOptions.pointToLayer(feature))
              return
            } else {
              // It seems the Leaflet realtime plugin takes care of it for us
              //oldLayer.setStyle(leafletOptions.style(feature))
            }
          }
          if (oldLayer.setIcon) {
            // FIXME: updating icon in place requires to recreate it anyway, so for now we recreate the whole marker
            //oldLayer.setIcon(_.get(leafletOptions.pointToLayer(feature, oldLayer.getLatLng()), 'options.icon'))
            return
          }
          // And coordinates
          const type = feature.geometry.type
          const coordinates = feature.geometry.coordinates
          // FIXME: support others geometry types ?
          switch (type) {
            case 'Point':
              oldLayer.setLatLng(L.GeoJSON.coordsToLatLngs(coordinates))
              break
            case 'LineString':
            case 'MultiLineString':
              oldLayer.setLatLngs(L.GeoJSON.coordsToLatLngs(coordinates, type === 'LineString' ? 0 : 1))
              break
            case 'Polygon':
            case 'MultiPolygon':
              oldLayer.setLatLngs(L.GeoJSON.coordsToLatLngs(coordinates, type === 'Polygon' ? 1 : 2))
              break
          }
          return oldLayer
        }
      }
      // Check for feature service layers
      if (options.service) {
        // Tell realtime plugin how to update/load data
        if (!_.has(leafletOptions, 'removeMissing')) leafletOptions.removeMissing = !options.probeService
        let initialized = !options.probeService // If no probe reference, nothing to be initialized
        _.set(leafletOptions, 'source', async (successCallback, errorCallback) => {
          // If the probe location is given by another service use it on initialization
          if (!initialized) {
            try {
              // Use probes as reference
              successCallback(await this.getProbeFeatures(options))
              initialized = true
            } catch (error) {
              errorCallback(error)
            }
          }
          let queryInterval
          if (leafletOptions.queryInterval) queryInterval = leafletOptions.queryInterval
          // If query interval not given use 2 x refresh interval as default value
          // this ensures we cover last interval if server/client update processes are not in sync
          if (!queryInterval && leafletOptions.interval) queryInterval = 2 * leafletOptions.interval
          try {
            successCallback(await this.getFeatures(options, queryInterval))
          } catch (error) {
            errorCallback(error)
          }
        })
        // If no interval given this is a manual update
        _.set(leafletOptions, 'start', _.has(leafletOptions, 'interval'))
      } else if (!_.has(leafletOptions, 'source')) {
        // Even for manual update leaflet realtime require a src
        _.set(leafletOptions, 'source', async (successCallback, errorCallback) => {})
        // But in this case do not try to start update automatically
        _.set(leafletOptions, 'start', false)
      }
    },
    async processGeoJsonLayerOptions (options) {
      let leafletOptions = options.leaflet || options
      let dataSource = _.get(leafletOptions, 'source')
      if (_.isNil(dataSource)) {
        // Empty valid GeoJson
        _.set(leafletOptions, 'source', { type: 'FeatureCollection', features: [] })
      } else if (typeof dataSource === 'string') { // URL ? If so load data
        let data
        // Check for feature service layers
        if (options.service) {
          data = await this.getFeatures(options)
        } else { // Otherwise standard HTTP
          data = await fetchGeoJson(dataSource)
        }
        _.set(leafletOptions, 'source', data)
      }
    },
    processClusterLayerOptions (options) {
      let leafletOptions = options.leaflet || options
      leafletOptions.container = this.createLeafletLayer(Object.assign({ type: 'markerClusterGroup' }, leafletOptions.cluster))
    },
    async createLeafletGeoJsonLayer (options) {
      let leafletOptions = options.leaflet || options
      // Check for valid type
      if (leafletOptions.type !== 'geoJson') return

      try {
        // Specific case of realtime layer
        if (leafletOptions.realtime) {
          this.processRealtimeGeoJsonLayerOptions(options)
        } else {
          await this.processGeoJsonLayerOptions(options)
        }
        // Specific case of clustered layer where we first need to create an underlying group
        if (leafletOptions.cluster) {
          this.processClusterLayerOptions(options)
        }
        // Optimize templating by creating compilers up-front
        let layerStyleTemplate = _.get(leafletOptions, 'template')
        if (layerStyleTemplate) {
          // We allow to template style properties according to feature, because it can be slow you have to specify a subset of properties
          leafletOptions.template = layerStyleTemplate.map(property => ({
            property, compiler: _.template(_.get(leafletOptions, property))
          }))
        }
        const popupTemplate = _.get(leafletOptions, 'popup.template')
        if (popupTemplate) {
          leafletOptions.popup.compiler = _.template(popupTemplate)
        }
        const tooltipTemplate = _.get(leafletOptions, 'tooltip.template')
        if (tooltipTemplate) {
          leafletOptions.tooltip.compiler = _.template(tooltipTemplate)
        }
        // Merge generic GeoJson options and layer options
        let geoJsonOptions = this.getGeoJsonOptions(options)
        Object.keys(geoJsonOptions).forEach(key => {
          // If layer provided do not override
          if (!_.has(leafletOptions, key)) _.set(leafletOptions, key, _.get(geoJsonOptions, key))
        })
        leafletOptions.layerStyle = this.convertFromSimpleStyleSpec(leafletOptions)
        let layer = this.createLeafletLayer(options)

        // Specific case of realtime layer where the underlying container also need to be added to map
        if (leafletOptions.realtime) {
          // Bind event
          layer.on('update', (data) => this.$emit('layer-updated', Object.assign({ layer: options, leafletLayer: layer }, data)))
          if (leafletOptions.container) layer.once('add', () => leafletOptions.container.addTo(this.map))
        }
        // Specific case of clustered layer where the group is added instead of the geojson layer
        if (leafletOptions.cluster && leafletOptions.container) {
          leafletOptions.container.addLayer(layer)
          layer = leafletOptions.container
        }
        // Specific case of time dimension layer where we embed the underlying geojson layer
        if (leafletOptions.timeDimension) {
          layer = this.createLeafletLayer(Object.assign({ type: 'timeDimension.layer.geoJson', source: layer }, leafletOptions.timeDimension))
        }
        return layer
      } catch (error) {
        logger.error(error)
        return null
      }
    },
    createMarkerFromStyle (latlng, markerStyle, feature) {
      if (markerStyle) {
        let icon = markerStyle.icon
        // Parse icon options to get icon object if any
        if (icon) {
          let options = icon.options
          icon = _.get(L, icon.type)(options)
          return _.get(L, markerStyle.type || 'marker')(latlng, { icon })
        } else {
          return _.get(L, markerStyle.type || 'marker')(latlng, markerStyle.options || markerStyle)
        }
      } else {
        return L.marker(latlng)
      }
    },
    convertFromSimpleStyleSpec (style, inPlace) {
      if (!style) return {}
      let convertedStyle = (inPlace ? style : {})
      let isIconSpec = false
      _.forOwn(style, (value, key) => {
        if (_.has(LeafletStyleMappings, key)) {
          const mapping = _.get(LeafletStyleMappings, key)
          // Specific options
          switch (key) {
            case 'icon-size':
            case 'icon-anchor':
            case 'marker-size':
              if (!Array.isArray(value)) value = [value, value]
              _.set(convertedStyle, mapping, value)
              break
            default:
              _.set(convertedStyle, mapping, value)
          }
          if (inPlace) _.unset(style, key)
          // In this case we have a marker spec
          if (mapping.startsWith('icon')) isIconSpec = true
        }
      })
      // Select the right icon type based on options
      if (isIconSpec) {
        _.set(convertedStyle, 'icon.type', (_.has(style, 'icon-classes')
              ? 'icon.fontAwesome' : _.has(style, 'icon-html') ? 'divIcon' : 'icon'))
        _.set(convertedStyle, 'type', 'marker')
      }
      return convertedStyle
    },
    registerLeafletStyle (type, generator) {
      this[type + 'Factory'].push(generator)
    },
    unregisterLeafletStyle (type, generator) {
      _.pull(this[type + 'Factory'], generator)
    },
    generateLeafletStyle () {
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
    getDefaultMarker (feature, latlng, options) {
      const properties = feature.properties
      let leafletOptions = options.leaflet || options
      let style = Object.assign({}, this.options.pointStyle,
        leafletOptions.layerStyle,
        this.convertFromSimpleStyleSpec(feature.style || feature.properties))

      // We allow to template style properties according to feature,
      // because it can be slow you have to specify a subset of properties
      if (leafletOptions.template) {
        leafletOptions.template.forEach(entry => {
          // Perform templating, set using simple spec mapping first then raw if property not found
          _.set(style, _.get(LeafletStyleMappings, entry.property, entry.property), entry.compiler({ properties, feature }))
        })
      }
      // We manage panes for z-index, so we need to forward it to marker options
      if (leafletOptions.pane) style.pane = leafletOptions.pane
      return (latlng ? this.createMarkerFromStyle(latlng, style) : style)
    },
    getDefaultStyle (feature, options) {
      const properties = feature.properties
      let leafletOptions = options.leaflet || options
      let style = Object.assign({}, this.options.featureStyle,
        leafletOptions.layerStyle,
        this.convertFromSimpleStyleSpec(feature.style || feature.properties))

      // We allow to template style properties according to feature,
      // because it can be slow you have to specify a subset of properties
      if (leafletOptions.template) {
        leafletOptions.template.forEach(entry => {
          // Perform templating, set using simple spec mapping first then raw if property not found
          _.set(style, _.get(LeafletStyleMappings, entry.property, entry.property), entry.compiler({ properties, feature }))
        })
      }
      // We manage panes for z-index, so we need to forward it to marker options
      if (leafletOptions.pane) style.pane = leafletOptions.pane
      return style
    },
    getDefaultPopup (feature, layer, options) {
      let leafletOptions = options.leaflet || options
      let popup
      if (feature.properties) {
        const popupStyle = leafletOptions.popup || this.options.popup
        // Default content
        let properties = feature.properties
        let html
        // Custom list given ?
        if (popupStyle) {
          if (popupStyle.pick) {
            properties = _.pick(properties, popupStyle.pick)
          } else if (popupStyle.omit) {
            properties = _.omit(properties, popupStyle.omit)
          } else if (popupStyle.template) {
            const compiler = popupStyle.compiler
            html = compiler({ properties, feature })
          }
        }
        // Default HTML table if no template
        if (!html) html = getHtmlTable(properties)
        if (!html) return null // Nothing to be displayed
        // Configured or default style
        if (popupStyle && popupStyle.options) {
          popup = L.popup(popupStyle.options, layer)
        } else {
          popup = L.popup({
            maxHeight: 400,
            maxWidth: 400,
            autoPan: false
          }, layer)
        }
        popup.setContent(html)
      }
      return popup
    },
    getDefaultTooltip (feature, layer, options) {
      let leafletOptions = options.leaflet || options
      let tooltip
      const tooltipStyle = leafletOptions.tooltip || this.options.tooltip
      if (tooltipStyle && feature.properties) {
        // Default content
        let properties = feature.properties
        let html
        if (tooltipStyle.property) {
          html = (_.has(properties, tooltipStyle.property)
          ? _.get(properties, tooltipStyle.property) : _.get(feature, tooltipStyle.property))
        } else if (tooltipStyle.template) {
          const compiler = tooltipStyle.compiler
          html = compiler({ properties, feature })
        }
        if (html) {
          tooltip = L.tooltip(tooltipStyle.options || { permanent: false }, layer)
          tooltip.setContent(html)
        }
      }
      return tooltip
    },
    getGeoJsonOptions (options = {}) {
      let geojsonOptions = {
        onEachFeature: (feature, layer) => {
          // Check for custom onEachFeature function
          if (typeof this.onLeafletFeature === 'function') this.onLeafletFeature(feature, layer, options)
          // Then for tooltip/popup
          // First remove previous popup if any
          if (layer.getPopup()) layer.unbindPopup()
          let popup = this.generateLeafletStyle('popup', feature, layer, options)
          if (popup) {
            // Because we build a new popup we need to restore previous state
            const wasOpen = (layer.getPopup() && layer.isPopupOpen())
            layer.bindPopup(popup)
            bindLeafletEvents(layer.getPopup(), LeafletEvents.Popup, this, options)
            if (wasOpen) layer.openPopup()
          }
          // First remove previous tooltip if any
          if (layer.getTooltip()) layer.unbindTooltip()
          let tooltip = this.generateLeafletStyle('tooltip', feature, layer, options)
          if (tooltip) {
            // Because we build a new tooltip we need to restore previous state
            const wasOpen = (layer.getTooltip() && layer.isTooltipOpen())
            layer.bindTooltip(tooltip)
            bindLeafletEvents(layer.getTooltip(), LeafletEvents.Tooltip, this, options)
            if (wasOpen) layer.openTooltip()
          }
        },
        style: (feature) => {
          return this.generateLeafletStyle('featureStyle', feature, options)
        },
        pointToLayer: (feature, latlng) => {
          let marker = this.generateLeafletStyle('markerStyle', feature, latlng, options)
          if (latlng && marker) bindLeafletEvents(marker, LeafletEvents.Marker, this, options)
          return marker
        }
      }

      return geojsonOptions
    },
    updateLayer (name, geoJson, remove) {
      // Retrieve the layer
      let layer = this.getLeafletLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      // Check if clustering on top of a realtime layer, in this case we have a top-level container
      let container
      if (typeof layer.getLayers === 'function') {
        container = layer
        layer = container.getLayers().find(layer => layer._container === container)
      }
      /* By default leaflet-realtime only performs add with manual update
        (see https://github.com/perliedman/leaflet-realtime/issues/136)
         but we'd like to perform similarly to automated updates
      if (remove && (typeof layer.remove === 'function')) layer.remove(geoJson)
      else if (typeof layer.update === 'function') layer.update(geoJson)
      */
      if (typeof layer._onNewData === 'function') layer._onNewData(layer.options.removeMissing, geoJson)
    }
  },
  created () {
    this.tooltipFactory = []
    this.popupFactory = []
    this.markerStyleFactory = []
    this.featureStyleFactory = []
    this.registerLeafletStyle('markerStyle', this.getDefaultMarker)
    this.registerLeafletStyle('featureStyle', this.getDefaultStyle)
    this.registerLeafletStyle('tooltip', this.getDefaultTooltip)
    this.registerLeafletStyle('popup', this.getDefaultPopup)
    this.registerLeafletConstructor(this.createLeafletGeoJsonLayer)
    // Performe required conversion for default feature styling
    if (this.options.featureStyle) this.convertFromSimpleStyleSpec(this.options.featureStyle, 'update-in-place')
    if (this.options.pointStyle) this.convertFromSimpleStyleSpec(this.options.pointStyle, 'update-in-place')
  }
}

export default geojsonLayersMixin
