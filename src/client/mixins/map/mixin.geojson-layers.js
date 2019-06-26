import L from 'leaflet'
import _ from 'lodash'
import logger from 'loglevel'
import 'leaflet-realtime'
import { GradientPath } from '../../leaflet/GradientPath'
import { fetchGeoJson, LeafletEvents, LeafletStyleMappings, bindLeafletEvents } from '../../utils'

// Override default Leaflet GeoJson utility to manage some specific use cases
const geometryToLayer = L.GeoJSON.geometryToLayer
L.GeoJSON.geometryToLayer = function (geojson, options) {
  const geometry = geojson.geometry
  const properties = geojson.properties
  if (geometry && properties && properties.geodesic) {
    if (geometry.type === 'LineString') {
      return new L.Geodesic([L.GeoJSON.coordsToLatLngs(geometry.coordinates, 0)],
        Object.assign({ steps: 100 }, options.style(geojson)))
    } else if (geometry.type === 'Point') {
      let layer = new L.Geodesic([], Object.assign({ fill: true, steps: 360 }, options.style(geojson)))
      layer.createCircle(L.GeoJSON.coordsToLatLng(geometry.coordinates), properties.radius)
      return layer
    }
  }
  if (geometry && properties && properties.gradient) {
    if (geometry.type === 'LineString') {
      return new GradientPath(geojson, options.style(geojson))
    }
  }
  return geometryToLayer(geojson, options)
}

export default {
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
      } else if (leafletOptions.cluster) { // Specific case of clustering
        leafletOptions.container = this.createLeafletLayer({ type: 'markerClusterGroup' }, leafletOptions.cluster)
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
              // Support Gradient Path
              if (typeof oldLayer.setData === 'function') oldLayer.setData(feature)
              else oldLayer.setLatLngs(L.GeoJSON.coordsToLatLngs(coordinates, type === 'LineString' ? 0 : 1))
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
        if (this.options.cluster) {
          if (leafletOptions.cluster) Object.assign(leafletOptions.cluster, this.options.cluster)
          else leafletOptions.cluster = Object.assign({}, this.options.cluster)
        }
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
    this.registerLeafletConstructor(this.createLeafletGeoJsonLayer)
  }
}
