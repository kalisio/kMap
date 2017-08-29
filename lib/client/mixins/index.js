'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mixin = require('./mixin.base');

var _mixin2 = _interopRequireDefault(_mixin);

var _mixin3 = require('./mixin.base-layers');

var _mixin4 = _interopRequireDefault(_mixin3);

var _mixin5 = require('./mixin.geojson-layers');

var _mixin6 = _interopRequireDefault(_mixin5);

var _mixin7 = require('./mixin.file-layers');

var _mixin8 = _interopRequireDefault(_mixin7);

var _mixin9 = require('./mixin.fullscreen');

var _mixin10 = _interopRequireDefault(_mixin9);

var _mixin11 = require('./mixin.measure');

var _mixin12 = _interopRequireDefault(_mixin11);

var _mixin13 = require('./mixin.scalebar');

var _mixin14 = _interopRequireDefault(_mixin13);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  base: _mixin2.default,
  baseLayers: _mixin4.default,
  geojsonLayers: _mixin6.default,
  fileLayers: _mixin8.default,
  fullscreen: _mixin10.default,
  measure: _mixin12.default,
  scalebar: _mixin14.default
};
module.exports = exports['default'];
//# sourceMappingURL=index.js.map