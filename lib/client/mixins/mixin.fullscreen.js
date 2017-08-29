'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

require('leaflet-fullscreen');

require('leaflet-fullscreen/dist/leaflet.fullscreen.css');

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fullscreenMixin = {
  mounted: function mounted() {
    var fullscreenControl = new _leaflet2.default.Control.Fullscreen();
    this.controls.push(fullscreenControl);
  }
};

_client.Store.set('mixins.map.fullscreen', fullscreenMixin);

exports.default = fullscreenMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.fullscreen.js.map