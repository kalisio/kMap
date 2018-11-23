import L from 'leaflet'
import _ from 'lodash'
import logger from 'loglevel'
import { LeafletEvents, bindLeafletEvents } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    async createLeafletGeoJsonLayer (options) {
      // Check for valid type
      if (options.type !== 'geoJson') return
      // Check for layer options object, create if required
      if (!_.has(options, 'arguments[1]')) _.set(options, 'arguments[1]', {})
      let layerOptions = _.get(options, 'arguments[1]')

      try {
        let container
        // Specific case of realtime layer where we first need to create an underlying container or setup Id function
        if (layerOptions.realtime) {
          // Alter type as required by the plugin
          options.type = 'realtime'
          const id = _.get(layerOptions, 'id')
          if (id) _.set(layerOptions, 'getFeatureId', (feature) => _.get(feature, 'properties.' + id))
          container = _.get(layerOptions, 'container')
          if (container) {
            layerOptions.container = container = this.createLeafletLayer({ type: container, arguments: [] })
          }
        }
        // Specific case of clustered layer where we first need to create an underlying group
        if (layerOptions.cluster) {
          container = this.createLeafletLayer({ type: 'markerClusterGroup', arguments: [ layerOptions.cluster ] })
        }
        // Merge generic GeoJson options and layer options
        let geoJsonOptions = this.getGeoJsonOptions(layerOptions)
        Object.keys(geoJsonOptions).forEach(key => {
          // If layer provided do not override
          if (!_.has(layerOptions, key)) layerOptions[key] = geoJsonOptions[key]
        })

        let dataSource = _.get(options, 'arguments[0]')
        if (_.isEmpty(dataSource)) {
          // Empty valid GeoJson
          _.set(options, 'arguments[0]', { type: 'FeatureCollection', features: [] })
        } else if ((typeof dataSource === 'string') && (options.type !== 'realtime')) { // URL ? If so load data
          let response = await fetch(dataSource)
          if (response.status !== 200) {
            throw new Error(`Impossible to fetch ${dataSource}: ` + response.status)
          }
          _.set(options, 'arguments[0]', await response.json())
        }

        let layer = this.createLeafletLayer(options)
        // Specific case of realtime layer where the underlying container also need to be added to map
        if (layerOptions.realtime && container) {
          layer.once('add', () => container.addTo(this.map))
        }
        // Specific case of clustered layer where the group is added instead of the geojson layer
        if (layerOptions.cluster && container) {
          container.addLayer(layer)
          layer = container
        }
        // Specific case of time dimension layer where we embed the underlying geojson layer
        if (layerOptions.timeDimension) {
          layer = this.createLeafletLayer({ type: 'timeDimension.layer.geoJson', arguments: [ layer, layerOptions.timeDimension ] })
        }
        return layer
      } catch (error) {
        logger.error(error)
        return null
      }
    },
    createMarkerFromStyle (latlng, markerStyle) {
      if (markerStyle) {
        let icon = markerStyle.icon
        // Parse icon options to get icon object if any
        if (icon) {
          icon = _.get(L, icon.type)(icon.options)
          return _.get(L, markerStyle.type || 'marker')(latlng, { icon })
        } else {
          return _.get(L, markerStyle.type || 'marker')(latlng, markerStyle.options)
        }
      } else {
        return L.marker(latlng)
      }
    },
    convertFromSimpleStyleSpec (style) {
      if (!style) return {}
      let convertedStyle = {}
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
        'icon-anchor': 'icon.options.iconAnchor',
        'icon-classes': 'icon.options.iconClasses'
      }
      _.forOwn(style, (value, key) => {
        const mapping = _.get(mappings, key)
        if (mapping) {
          // Specific options
          switch (key) {
            case 'icon-anchor':
            case 'marker-size':
              if (!Array.isArray(value)) value = [value, value]
              break
            default:
              _.set(convertedStyle, mapping, value)
          }
          // In this case we have a marker spec
          if (key.startsWith('icon') || key.startsWith('marker')) {
            _.set(convertedStyle, 'icon.type', _.has(style, 'icon-classes') ? 'icon.fontAwesome' : 'icon')
            _.set(convertedStyle, 'type', 'marker')
          }
        }
      })
      return convertedStyle
    },
    registerLeafletStyle (type, generator) {
      this[type + 'Factory'].push(generator)
    },
    generateLeafletStyle () {
      let args = Array.from(arguments)
      const type = args[0]
      args.shift()
      let style
      // Iterate over all registered generators until we find one
      for (let i = 0; i < this[type + 'Factory'].length; i++) {
        const generator = this[type + 'Factory'][i]
        style = generator(...args)
        if (style) break
      }
      return style
    },
    getPointMarker (layerOptions, feature, latlng) {
      let style = this.generateLeafletStyle('markerStyle', feature, latlng)
      return style || // Feature style overrides layer style which overrides default style
        this.createMarkerFromStyle(latlng, Object.assign({}, this.options.pointStyle,
        this.convertFromSimpleStyleSpec(layerOptions),
        this.convertFromSimpleStyleSpec(feature.style || feature.properties)))
    },
    getFeatureStyle (layerOptions, feature) {
      let style = this.generateLeafletStyle('featureStyle', feature)
      return style || // Feature style overrides layer style which overrides default style
        Object.assign({}, this.options.featureStyle || {
          opacity: 1,
          radius: 6,
          color: 'red',
          fillOpacity: 0.5,
          fillColor: 'green'
        },
        this.convertFromSimpleStyleSpec(layerOptions),
        this.convertFromSimpleStyleSpec(feature.style || feature.properties))
    },
    getFeaturePopup (layerOptions, feature, layer) {
      let popup = this.generateLeafletStyle('popup', feature, layer)
      if (!popup && feature.properties) {
        const popupStyle = layerOptions.popup || this.options.popup
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
        properties = _.pickBy(properties, value => !_.isNil(value))
        const keys = _.keys(properties)
        let html
        if (keys.length === 0) return null
        else if (keys.length === 1) html = _.get(properties, keys[0])
        else {
          const borderStyle = ' style="border: 1px solid black; border-collapse: collapse;"'
          html = '<table' + borderStyle + '>'
          html += '<tr' + borderStyle + '><th' + borderStyle + '>Property</th><th>Value</th></tr>'
          html += keys
            .map(key => '<tr style="border: 1px solid black; border-collapse: collapse;"><th' +
              borderStyle + '>' + key + '</th><th>' + _.get(properties, key) + '</th></tr>')
            .join('')
          html += '</table>'
        }
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
    getFeatureTooltip (layerOptions, feature, layer) {
      let tooltip = this.generateLeafletStyle('tooltip', feature, layer)
      if (!tooltip) {
        const tooltipStyle = layerOptions.tooltip || this.options.tooltip
        if (tooltipStyle && feature.properties) {
          // Default content
          let properties = feature.properties
          let html
          if (tooltipStyle.property) {
            html = _.get(properties, tooltipStyle.property)
          } else if (tooltipStyle.template) {
            let compiler = _.template(tooltipStyle.template)
            html = compiler(properties)
          }
          if (html) {
            tooltip = L.tooltip(tooltipStyle.options || { permanent: false }, layer)
            tooltip.setContent(html)
          }
        }
      }
      return tooltip
    },
    getGeoJsonOptions (layerOptions = {}) {
      let geojsonOptions = {
        onEachFeature: (feature, layer) => {
          let popup = this.getFeaturePopup(layerOptions, feature, layer)
          if (popup) {
            layer.bindPopup(popup)
            bindLeafletEvents(layer.getPopup(), LeafletEvents.Popup, this)
          }

          let tooltip = this.getFeatureTooltip(layerOptions, feature, layer)
          if (tooltip) {
            layer.bindTooltip(tooltip)
            bindLeafletEvents(layer.getTooltip(), LeafletEvents.Tooltip, this)
          }
        },
        style: (feature) => {
          return this.getFeatureStyle(layerOptions, feature)
        },
        pointToLayer: (feature, latlng) => {
          let marker = this.getPointMarker(layerOptions, feature, latlng)
          if (marker) bindLeafletEvents(marker, LeafletEvents.Marker, this)
          return marker
        }
      }

      return geojsonOptions
    }
  },
  created () {
    this.tooltipFactory = []
    this.popupFactory = []
    this.markerStyleFactory = []
    this.featureStyleFactory = []
    this.registerLeafletConstructor(this.createLeafletGeoJsonLayer)
  }
}

export default geojsonLayersMixin
