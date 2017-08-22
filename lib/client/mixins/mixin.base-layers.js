'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet-basemaps/L.Control.Basemaps.js');

require('leaflet-basemaps/L.Control.Basemaps.css');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var baseLayersMixin = {
  data: function data() {
    return {};
  },

  methods: {
    setupBaseLayers: function setupBaseLayers() {
      var _this = this;

      this.configuration.baseLayers.forEach(function (baseLayer) {
        _this.baseLayers.push(_leaflet2.default[baseLayer.type].apply(_leaflet2.default, (0, _toConsumableArray3.default)(baseLayer.arguments)));
      });
    }
  },
  created: function created() {
    // This is the right place to declare private members because Vue has already processed observed data
    this.baseLayers = [];
  },
  mounted: function mounted() {
    this.setupBaseLayers();
    var baseLayersControl = _leaflet2.default.control.basemaps({
      basemaps: this.baseLayers,
      position: 'bottomleft',
      tileX: 0, // tile X coordinate
      tileY: 0, // tile Y coordinate
      tileZ: 1 // tile zoom level
    });
    this.controls.push(baseLayersControl);
  }
};

_client.Store.set('mixins.map.baseLayers', baseLayersMixin);

exports.default = baseLayersMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.base-layers.js.map