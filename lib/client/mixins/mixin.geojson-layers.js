'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet.markercluster');

require('leaflet.markercluster/dist/MarkerCluster.css');

require('leaflet.markercluster/dist/MarkerCluster.Default.css');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var geojsonLayersMixin = {
  methods: {
    addGeoJson: function addGeoJson(geojson, name, geojsonOptions) {
      return this.addLayer(_leaflet2.default.geoJson(geojson, geojsonOptions || this.getGeoJsonOptions()), name);
    },
    addGeoJsonCluster: function addGeoJsonCluster(geojson, name, geojsonOptions) {
      var cluster = _leaflet2.default.markerClusterGroup();
      cluster.addLayer(_leaflet2.default.geoJson(geojson, geojsonOptions || this.getGeoJsonOptions()));
      return this.addLayer(cluster, name);
    },
    createMarkerFromStyle: function createMarkerFromStyle(latlng, markerStyle) {
      if (markerStyle) {
        var icon = markerStyle.icon;
        // Parse icon options to get icon object if any
        if (icon) {
          icon = _leaflet2.default[icon.type](icon.options);
          return _leaflet2.default[markerStyle.type](latlng, { icon: icon });
        } else {
          return _leaflet2.default[markerStyle.type](latlng, markerStyle.options);
        }
      } else {
        return _leaflet2.default.marker(latlng);
      }
    },
    getGeoJsonOptions: function getGeoJsonOptions() {
      var _this = this;

      var geojsonOptions = {
        onEachFeature: function onEachFeature(feature, layer) {
          var featureStyle = _this.configuration.featureStyle;
          // Custom defined function in component ?
          if (typeof _this.getFeaturePopup === 'function') {
            layer.bindPopup(_this.getFeaturePopup(feature, layer));
          } else if (feature.properties) {
            // Default content
            var borderStyle = ' style="border: 1px solid black; border-collapse: collapse;"';
            var html = '<table' + borderStyle + '>';
            html += '<tr' + borderStyle + '><th' + borderStyle + '>Property</th><th>Value</th></tr>';
            var properties = Object.keys(feature.properties);
            // Custom list given ?
            if (featureStyle && featureStyle.popup) {
              if (featureStyle.popup.properties) {
                properties = featureStyle.popup.properties;
              }
              if (featureStyle.popup.excludedProperties) {
                properties = properties.filter(function (property) {
                  return !featureStyle.popup.excludedProperties.includes(property);
                });
              }
            }
            html += properties.filter(function (k) {
              return feature.properties[k] !== null && feature.properties[k] !== undefined;
            }).map(function (k) {
              return '<tr style="border: 1px solid black; border-collapse: collapse;"><th' + borderStyle + '>' + k + '</th><th>' + feature.properties[k] + '</th></tr>';
            }).join('');
            html += '</table>';
            // Configured or default style
            if (featureStyle && featureStyle.popup && featureStyle.popup.options) {
              layer.bindPopup(html, featureStyle.popup.options);
            } else {
              layer.bindPopup(html, {
                maxHeight: 400,
                maxWidth: 400
              });
            }
          }
          // Custom defined function in component ?
          if (typeof _this.getFeatureTooltip === 'function') {
            layer.bindTooltip(_this.getFeatureTooltip(feature, layer));
          } else if (featureStyle && featureStyle.tooltip && featureStyle.tooltip.property && feature.properties) {
            var tooltip = feature.properties[featureStyle.tooltip.property];
            if (tooltip) {
              layer.bindTooltip(tooltip, featureStyle.tooltip.options || { permanent: true });
            }
          }
        },
        style: function style(feature) {
          // Custom defined function in component ?
          if (typeof _this.getFeatureStyle === 'function') {
            return _this.getFeatureStyle(feature);
          } else {
            // Configured or default style
            return _this.configuration.featureStyle || {
              opacity: 1,
              radius: 6,
              color: 'red',
              fillOpacity: 0.5,
              fillColor: 'green'
            };
          }
        },
        pointToLayer: function pointToLayer(feature, latlng) {
          // Custom defined function in component ?
          if (typeof _this.getPointMarker === 'function') {
            return _this.getPointMarker(feature, latlng);
          } else {
            // Configured or default style
            return _this.createMarkerFromStyle(latlng, _this.configuration.pointStyle);
          }
        }
      };

      return geojsonOptions;
    }
  }
};

_client.Store.set('mixins.map.geojsonLayers', geojsonLayersMixin);

exports.default = geojsonLayersMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.geojson-layers.js.map