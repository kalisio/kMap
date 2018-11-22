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
          if (id) _.set(layerOptions, 'getFeatureId', (feature) => _.get(feature, id))
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
        let geoJsonOptions = this.getGeoJsonOptions()
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
            throw new Error(`Impossible to fetch ${dataSopurce}: ` + response.status)
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
      let convertedStyle = {}
      const mappings = {
        'stroke': 'color',
        'stroke-opacity': 'opacity',
        'stroke-width': 'weight',
        'fill-opacity': 'fillOpacity',
        'fill-color': 'fillColor'
      }
      _.forOwn(style, (value, key) => {
        const mapping = _.get(mappings, key)
        if (mapping) _.set(convertedStyle, mapping, value)
      })

      return convertedStyle
    },
    getGeoJsonOptions () {
      let geojsonOptions = {
        onEachFeature: (feature, layer) => {
          const featureStyle = this.options.featureStyle
          let popup
          // Custom defined function in component for popup ?
          if (typeof this.getFeaturePopup === 'function') {
            popup = this.getFeaturePopup(feature, layer)
          }
          if (!popup && feature.properties) {
            // Default content
            const borderStyle = ' style="border: 1px solid black; border-collapse: collapse;"'
            let html = '<table' + borderStyle + '>'
            html += '<tr' + borderStyle + '><th' + borderStyle + '>Property</th><th>Value</th></tr>'
            let properties = Object.keys(feature.properties)
            // Custom list given ?
            if (featureStyle && featureStyle.popup) {
              if (featureStyle.popup.properties) {
                properties = featureStyle.popup.properties
              }
              if (featureStyle.popup.excludedProperties) {
                properties = properties.filter(property => !featureStyle.popup.excludedProperties.includes(property))
              }
            }
            html += properties
            .filter(k => feature.properties[k] !== null && feature.properties[k] !== undefined)
            .map(k => '<tr style="border: 1px solid black; border-collapse: collapse;"><th' + borderStyle + '>' + k + '</th><th>' + feature.properties[k] + '</th></tr>')
            .join('')
            html += '</table>'
            // Configured or default style
            if (featureStyle && featureStyle.popup && featureStyle.popup.options) {
              layer.bindPopup(html, featureStyle.popup.options)
              popup = L.popup(featureStyle.popup.options, layer)
            } else {
              popup = L.popup({
                maxHeight: 400,
                maxWidth: 400
              }, layer)
            }
            popup.setContent(html)
          }
          if (popup) {
            layer.bindPopup(popup)
            bindLeafletEvents(layer.getPopup(), LeafletEvents.Popup, this)
          }

          let tooltip
          // Custom defined function in component for tooltip ?
          if (typeof this.getFeatureTooltip === 'function') {
            tooltip = this.getFeatureTooltip(feature, layer)
          } else if (featureStyle && featureStyle.tooltip && featureStyle.tooltip.property && feature.properties) {
            tooltip = L.tooltip(featureStyle.tooltip.options || { permanent: false }, layer)
            tooltip.setContent(feature.properties[featureStyle.tooltip.property])
          }
          if (tooltip) {
            layer.bindTooltip(tooltip)
            bindLeafletEvents(layer.getTooltip(), LeafletEvents.Tooltip, this)
          }
        },
        style: (feature) => {
          let style
          // Custom defined function in component ?
          if (typeof this.getFeatureStyle === 'function') {
            style = this.getFeatureStyle(feature)
          }
          if (!style) {
            // Feature style overrides default style
            style = Object.assign({}, this.options.featureStyle || {
              opacity: 1,
              radius: 6,
              color: 'red',
              fillOpacity: 0.5,
              fillColor: 'green'
            }, this.convertFromSimpleStyleSpec(feature.properties || {}))
          }
          return style
        },
        pointToLayer: (feature, latlng) => {
          let marker
          // Custom defined function in component ?
          if (typeof this.getPointMarker === 'function') {
            marker = this.getPointMarker(feature, latlng)
          }
          if (!marker) {
            // Configured or default style
            marker = this.createMarkerFromStyle(latlng, this.options.pointStyle)
          }
          if (marker) bindLeafletEvents(marker, LeafletEvents.Marker, this)
          return marker
        }
      }

      return geojsonOptions
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletGeoJsonLayer)
  }
}

export default geojsonLayersMixin
