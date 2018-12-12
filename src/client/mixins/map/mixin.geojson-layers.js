import L from 'leaflet'
import _ from 'lodash'
import logger from 'loglevel'
import 'leaflet-realtime'
import { LeafletEvents, bindLeafletEvents } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    async createLeafletGeoJsonLayer (options) {
      let leafletOptions = options.leaflet || options
      // Check for valid type
      if (leafletOptions.type !== 'geoJson') return
      
      try {
        let container
        // Specific case of realtime layer
        if (leafletOptions.realtime) {
          // Alter type as required by the plugin
          leafletOptions.type = 'realtime'
          // We first need to create an underlying container or setup Id function
          const id = _.get(options, 'featureId', _.get(leafletOptions, 'id'))
          if (id) _.set(leafletOptions, 'getFeatureId', (feature) => _.get(feature, 'properties.' + id))
          container = _.get(leafletOptions, 'container')
          if (container) {
            leafletOptions.container = container = this.createLeafletLayer({ type: container })
          }
          // Check for feature service layers
          if (options.service) {
            // Tell realtime plugin how to load data
            leafletOptions.removeMissing = false
            leafletOptions.updateFeature = function(feature, oldLayer) {
              // A new feature is coming, create it
              if (!oldLayer) return
              // An existing one is found, simply update styling, etc.
              leafletOptions.onEachFeature(feature, oldLayer)
              oldLayer.setStyle(leafletOptions.style(feature))
              // And coordinates for points
              // FIXME: support others geometry types ?
              if (feature.geometry.type === 'Point') {
                oldLayer.setLatLng([feature.geometry.coordinates[1], feature.geometry.coordinates[0]])
              }
              return oldLayer
            }
            
            _.set(leafletOptions, 'source', async (successCallback, errorCallback) => {
              // If the probe location is given by another service use it on initialization
              if (options.probeService) {
                try {
                  // Use probes as reference
                  successCallback(await this.$api.getService(options.probeService).find({}))
                } catch (error) {
                  errorCallback(error)
                }
              }
              // Last available data only for realtime visualization
              let query = {
                $limit: 1, $sort: { time: -1 },
                $groupBy: options.featureId,
                $aggregate: options.variables.map(variable => variable.name)
              }
              // Request feature with at least one data available during last interval
              if (leafletOptions.interval) {
                query.time = {
                  $gte: this.currentTime.clone().subtract({ seconds: 2 * leafletOptions.interval / 1000 }).format(),
                  $lte: this.currentTime.format() 
                }
              } else {
                query.time = {
                  $lte: this.currentTime.format() 
                }
              }
              try {
                successCallback(await this.$api.getService(options.service).find({ query }))
              } catch (error) {
                errorCallback(error)
              }
            })
          }
        } else {
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
        }
        // Specific case of clustered layer where we first need to create an underlying group
        if (leafletOptions.cluster) {
          container = this.createLeafletLayer(Object.assign({ type: 'markerClusterGroup' }, leafletOptions.cluster))
        }
        // Merge generic GeoJson options and layer options
        let geoJsonOptions = this.getGeoJsonOptions(options)
        Object.keys(geoJsonOptions).forEach(key => {
          // If layer provided do not override
          if (!_.has(leafletOptions, key)) _.set(leafletOptions, key, _.get(geoJsonOptions, key))
        })

        let layer = this.createLeafletLayer(options)

        // Specific case of realtime layer where the underlying container also need to be added to map
        if (leafletOptions.realtime && container) {
          layer.once('add', () => container.addTo(this.map))
        }
        // Specific case of clustered layer where the group is added instead of the geojson layer
        if (leafletOptions.cluster && container) {
          container.addLayer(layer)
          layer = container
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
    getPointMarker (options, feature, latlng) {
      let leafletOptions = options.leaflet || options
      let style = this.generateLeafletStyle('markerStyle', feature, latlng)
      return style || // Feature style overrides layer style which overrides default style
        this.createMarkerFromStyle(latlng, Object.assign({}, this.options.pointStyle,
        this.convertFromSimpleStyleSpec(leafletOptions),
        this.convertFromSimpleStyleSpec(feature.style || feature.properties)))
    },
    getFeatureStyle (options, feature) {
      let leafletOptions = options.leaflet || options
      let style = this.generateLeafletStyle('featureStyle', feature)
      return style || // Feature style overrides layer style which overrides default style
        Object.assign({}, this.options.featureStyle || {
          opacity: 1,
          radius: 6,
          color: 'red',
          fillOpacity: 0.5,
          fillColor: 'green'
        },
        this.convertFromSimpleStyleSpec(leafletOptions),
        this.convertFromSimpleStyleSpec(feature.style || feature.properties))
    },
    getFeaturePopup (options, feature, layer) {
      let leafletOptions = options.leaflet || options
      let popup = this.generateLeafletStyle('popup', feature, layer)
      if (!popup && feature.properties) {
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
    getFeatureTooltip (options, feature, layer) {
      let leafletOptions = options.leaflet || options
      let tooltip = this.generateLeafletStyle('tooltip', feature, layer)
      if (!tooltip) {
        const tooltipStyle = leafletOptions.tooltip || this.options.tooltip
        if (tooltipStyle && feature.properties) {
          // Default content
          let properties = feature.properties
          let html
          if (tooltipStyle.property) {
            html = _.get(properties, tooltipStyle.property)
          } else if (tooltipStyle.template) {
            let compiler = _.template(tooltipStyle.template, { variable: 'properties' })
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
    getGeoJsonOptions (options = {}) {
      let geojsonOptions = {
        onEachFeature: (feature, layer) => {
          let popup = this.getFeaturePopup(options, feature, layer)
          if (popup) {
            layer.bindPopup(popup)
            bindLeafletEvents(layer.getPopup(), LeafletEvents.Popup, this, options)
          }

          let tooltip = this.getFeatureTooltip(options, feature, layer)
          if (tooltip) {
            layer.bindTooltip(tooltip)
            bindLeafletEvents(layer.getTooltip(), LeafletEvents.Tooltip, this, options)
          }
        },
        style: (feature) => {
          return this.getFeatureStyle(options, feature)
        },
        pointToLayer: (feature, latlng) => {
          let marker = this.getPointMarker(options, feature, latlng)
          if (marker) bindLeafletEvents(marker, LeafletEvents.Marker, this, options)
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
