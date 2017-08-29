'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet-filelayer');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fileLayersMixin = {
  mounted: function mounted() {
    var _this = this;

    _leaflet2.default.Control.FileLayerLoad.LABEL = '<i class="material-icons">file_upload</i>';
    var fileControl = _leaflet2.default.Control.fileLayerLoad({
      // Allows you to use a customized version of L.geoJson.
      // For example if you are using the Proj4Leaflet leaflet plugin,
      // you can pass L.Proj.geoJson and load the files into the
      // L.Proj.GeoJson instead of the L.geoJson.
      layer: _leaflet2.default.geoJson,
      // See http://leafletjs.com/reference.html#geojson-options
      layerOptions: this.getGeoJsonOptions(),
      // Add to map after loading (default: true) ?
      addToMap: false,
      // File size limit in kb (default: 1024) ?
      fileSizeLimit: this.configuration.fileSizeLimit || 1024 * 1024,
      // Restrict accepted file formats (default: .geojson, .kml, and .gpx) ?
      formats: ['.geojson', '.kml']
    });
    this.controls.push(fileControl);
    this.$on('controlsReady', function (_) {
      fileControl.loader.on('data:loaded', function (event) {
        // Remove any previous layer
        _this.removeLayer(_this.fileLayer);
        // Keep track of layer
        _this.fileLayer = _this.addLayer(event.layer, event.filename);
        _this.$emit('fileLayerLoaded', _this.fileLayer, event.filename);
      });
    });
  }
};

_client.Store.set('mixins.map.fileLayers', fileLayersMixin);

exports.default = fileLayersMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.file-layers.js.map