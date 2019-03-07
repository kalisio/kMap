import L from 'leaflet'
import _ from 'lodash'
import logger from 'loglevel'
import 'leaflet-realtime'
import { LeafletEvents, bindLeafletEvents, getHtmlTable, templateObject } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    processRealtimeGeoJsonLayerOptions (options) {
      let leafletOptions = options.leaflet || options
      // Alter type as required by the plugin
      leafletOptions.type = 'realtime'
      // We first need to create an underlying container or setup Id function
      const id = _.get(options, 'featureId', _.get(leafletOptions, 'id'))
      if (id) _.set(leafletOptions, 'getFeatureId', (feature) => _.get(feature, 'properties.' + id))
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
          if (oldLayer.setStyle) oldLayer.setStyle(leafletOptions.style(feature))
          if (oldLayer.setIcon) oldLayer.setIcon(_.get(leafletOptions.pointToLayer(feature), 'options.icon'))
          // And coordinates for points
          // FIXME: support others geometry types ?
          if (feature.geometry.type === 'Point') {
            oldLayer.setLatLng([feature.geometry.coordinates[1], feature.geometry.coordinates[0]])
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
      } else if (!_.has(leafletOptions, 'source')) { // Even for manual update leaflet realtime require a src
        _.set(leafletOptions, 'source', async (successCallback, errorCallback) => {})
      }
    },
    async processGeoJsonLayerOptions (options) {
      let leafletOptions = options.leaflet || options
      let dataSource = _.get(leafletOptions, 'source')
      if (_.isNil(dataSource)) {
        // Empty valid GeoJson
        _.set(leafletOptions, 'source', { type: 'FeatureCollection', features: [] })
      } else if (typeof dataSource === 'string') { // URL ? If so load data
        let response = await fetch(dataSource)
        if (response.status !== 200) {
          throw new Error(`Impossible to fetch ${dataSource}: ` + response.status)
        }
        _.set(leafletOptions, 'source', await response.json())
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
          // We allow to template some properties
          if (feature.properties && options) {
            const properties = feature.properties
            // Avoid updating in place and loose template(s)
            options = Object.assign({}, templateObject({ properties, feature }, options, ['iconUrl', 'html']))
          }
          icon = _.get(L, icon.type)(options)
          return _.get(L, markerStyle.type || 'marker')(latlng, { icon })
        } else {
          return _.get(L, markerStyle.type || 'marker')(latlng, markerStyle.options)
        }
      } else {
        return L.marker(latlng)
      }
    },
    convertFromSimpleStyleSpec (style, inPlace) {
      if (!style) return {}
      let convertedStyle = (inPlace ? style : {})
      const mappings = {
        'stroke': 'color',
        'stroke-opacity': 'opacity',
        'stroke-width': 'weight',
        'fill-opacity': 'fillOpacity',
        'fill-color': 'fillColor',
        'marker-size': 'icon.options.iconSize',
        'marker-symbol': 'icon.options.iconUrl',
        'marker-color': 'icon.options.markerColor',
        'icon-color': 'icon.options.iconColor',
        'icon-size': 'icon.options.iconSize',
        'icon-anchor': 'icon.options.iconAnchor',
        'icon-classes': 'icon.options.iconClasses',
        'icon-html': 'icon.options.html',
        'icon-class': 'icon.options.className'
      }
      _.forOwn(style, (value, key) => {
        if (_.has(mappings, key)) {
          const mapping = _.get(mappings, key)
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
          if (key.startsWith('icon') || key.startsWith('marker')) {
            _.set(convertedStyle, 'icon.type', (_.has(style, 'icon-classes') ?
              'icon.fontAwesome' : _.has(style, 'icon-html') ? 'divIcon' : 'icon'))
            _.set(convertedStyle, 'type', 'marker')
          }
        }
      })
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
      let leafletOptions = options.leaflet || options
      return this.createMarkerFromStyle(latlng, Object.assign({}, this.options.pointStyle,
        leafletOptions.layerStyle,
        this.convertFromSimpleStyleSpec(feature.style || feature.properties)), feature)
    },
    getDefaultStyle (feature, options) {
      let leafletOptions = options.leaflet || options
      return Object.assign({}, this.options.featureStyle || {
        opacity: 1,
        radius: 6,
        color: 'red',
        fillOpacity: 0.5,
        fillColor: 'green'
      },
        leafletOptions.layerStyle,
        this.convertFromSimpleStyleSpec(feature.style || feature.properties))
    },
    getDefaultPopup (feature, layer, options) {
      let leafletOptions = options.leaflet || options
      let popup
      if (feature.properties) {
        const popupStyle = leafletOptions.popup || this.options.popup
        // Default content
        let properties = feature.properties
        // Custom list given ?
        if (popupStyle) {
          if (popupStyle.pick) {
            properties = _.pick(properties, popupStyle.pick)
          } else if (popupStyle.omit) {
            properties = _.omit(properties, popupStyle.omit)
          }
        }
        let html = getHtmlTable(properties)
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
          let compiler = _.template(tooltipStyle.template)
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
          if (marker) bindLeafletEvents(marker, LeafletEvents.Marker, this, options)
          return marker
        }
      }

      return geojsonOptions
    },
    updateLayer (name, geoJson, remove) {
      // Retrieve the layer
      let layer = this.getLeafletLayerByName(name)
      if (!layer) return // Cannot update invisible layer
      if (remove && (typeof layer.remove === 'function')) layer.remove(geoJson)
      else if (typeof layer.update === 'function') layer.update(geoJson)
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
