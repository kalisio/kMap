import L from 'leaflet'
import _ from 'lodash'
import { LeafletEvents, bindLeafletEvents } from '../../utils'

let geojsonLayersMixin = {
  methods: {
    createLeafletGeoJsonLayer (options) {
      // Check for valid type
      if (options.type !== 'geoJson') return
      let layerOptions = _.get(options, 'arguments[1]', {})
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
      // Generic GeoJson options
      if (this.getGeoJsonOptions && layerOptions) {
        _.assign(layerOptions, this.getGeoJsonOptions())
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
      const mappings = {
        'stroke': 'color',
        'stroke-opacity': 'opacity',
        'stroke-width': 'weight',
        'fill-opacity': 'fillOpacity',
        'fill-color': 'fillColor'
      }
      _.forOwn(style, (value, key) => {
        const mapping = _.get(mappings, key)
        if (mapping) _.set(style, mapping, value)
      })

      return style
    },
    getGeoJsonOptions () {
      let geojsonOptions = {
        onEachFeature: (feature, layer) => {
          const featureStyle = this.options.featureStyle
          // Custom defined function in component for popup ?
          if (typeof this.getFeaturePopup === 'function') {
            let popup = this.getFeaturePopup(feature, layer)
            if (popup) layer.bindPopup(popup)
          } else if (feature.properties) {
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
            } else {
              layer.bindPopup(html, {
                maxHeight: 400,
                maxWidth: 400
              })
            }
          }
          if (layer.getPopup()) bindLeafletEvents(layer.getPopup(), LeafletEvents.Popup, this)

          // Custom defined function in component for tooltip ?
          if (typeof this.getFeatureTooltip === 'function') {
            let tooltip = this.getFeatureTooltip(feature, layer)
            if (tooltip) layer.bindTooltip(tooltip)
          } else if (featureStyle && featureStyle.tooltip && featureStyle.tooltip.property && feature.properties) {
            let tooltip = feature.properties[featureStyle.tooltip.property]
            if (tooltip) {
              layer.bindTooltip(tooltip, featureStyle.tooltip.options || { permanent: true })
            }
          }
          if (layer.getTooltip()) bindLeafletEvents(layer.getTooltip(), LeafletEvents.Tooltip, this)
        },
        style: (feature) => {
          // Custom defined function in component ?
          if (typeof this.getFeatureStyle === 'function') {
            return this.getFeatureStyle(feature)
          } else {
            // Configured or default style
            return this.options.featureStyle || {
              opacity: 1,
              radius: 6,
              color: 'red',
              fillOpacity: 0.5,
              fillColor: 'green'
            }
          }
        },
        pointToLayer: (feature, latlng) => {
          let marker = null
          // Custom defined function in component ?
          if (typeof this.getPointMarker === 'function') {
            marker = this.getPointMarker(feature, latlng)
          } else {
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
