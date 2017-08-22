'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet-measure/dist/leaflet-measure.js');

require('leaflet-measure/dist/leaflet-measure.css');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var measureMixin = {
  mounted: function mounted() {
    var measureControl = new _leaflet2.default.Control.Measure({ position: 'topright' });
    this.controls.push(measureControl);
  }
};

_client.Store.set('mixins.map.measure', measureMixin);

exports.default = measureMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.measure.js.map