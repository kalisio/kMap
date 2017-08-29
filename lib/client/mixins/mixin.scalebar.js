'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _leaflet = require('leaflet');

var _leaflet2 = _interopRequireDefault(_leaflet);

var _client = require('kCore/client');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var scalebarMixin = {
  mounted: function mounted() {
    var scalebarControl = _leaflet2.default.control.scale();
    this.controls.push(scalebarControl);
  }
};

_client.Store.set('mixins.map.scalebar', scalebarMixin);

exports.default = scalebarMixin;
module.exports = exports['default'];
//# sourceMappingURL=mixin.scalebar.js.map