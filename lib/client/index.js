'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mixins = undefined;
exports.default = init;

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _mixins2 = require('./mixins');

var _mixins = _interopRequireWildcard(_mixins2);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.mixins = _mixins;


var debug = (0, _debug2.default)('kalisio:kMap');

function init() {
  var app = this;

  debug('Initializing kalisio map');
}
//# sourceMappingURL=index.js.map