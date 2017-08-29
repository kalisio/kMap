'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet/dist/leaflet.css');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Fix to make Leaflet assets be correctly inserted by webpack
delete _leaflet2.default.Icon.Default.prototype._getIconUrl;
_leaflet2.default.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

var baseMixin = {
  methods: {
    setupControls: function setupControls() {
      var _this = this;

      this.controls.forEach(function (control) {
        return control.addTo(_this.map);
      });
      this.$emit('controlsReady');
    },
    center: function center(longitude, latitude, zoomLevel) {
      this.map.setView(new _leaflet2.default.LatLng(latitude, longitude), zoomLevel || 12);
    },
    removeLayer: function removeLayer(layer) {
      if (!layer) return;

      this.overlayLayersControl.removeLayer(layer);
      // If it was visible remove it from map
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
      this.checkOverlayLayersControlVisibility();
    },
    addLayer: function addLayer(layer, name) {
      if (layer && !this.map.hasLayer(layer)) {
        // Check if layer is visible by default
        var visible = true;
        if (layer.options.hasOwnProperty('visible')) {
          visible = layer.options.visible;
        }
        if (visible) {
          this.map.addLayer(layer);
        }
        this.overlayLayersControl.addOverlay(layer, name);
        this.checkOverlayLayersControlVisibility();
      }
      return layer;
    },
    checkOverlayLayersControlVisibility: function checkOverlayLayersControlVisibility() {
      var _this2 = this;

      // Hidden while nothing has been loaded, default state
      this.overlayLayersControl.getContainer().style.visibility = 'hidden';
      this.overlayLayersControl._layers.forEach(function (_) {
        // We know there is at least one layer to display
        _this2.overlayLayersControl.getContainer().style.visibility = 'visible';
      });
    }
  },
  created: function created() {
    // This is the right place to declare private members because Vue has already processed observed data
    this.controls = [];
  },
  mounted: function mounted() {
    var _this3 = this;

    // Initialize the map now the DOM is ready
    this.map = _leaflet2.default.map('map').setView([46, 1.5], 5);
    // Add empty basic overlays control
    this.overlayLayersControl = _leaflet2.default.control.layers({}, {});
    this.controls.push(this.overlayLayersControl);
    this.$on('mapReady', function (_) {
      _this3.setupControls();
      _this3.checkOverlayLayersControlVisibility();
    });
  },
  beforeDestroy: function beforeDestroy() {
    this.map.remove();
  }
};

_client.Store.set('mixins.map.base', baseMixin);

exports.default = baseMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.base.js.map