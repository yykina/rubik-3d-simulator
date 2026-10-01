/*
 * cubejs — 3×3×3 魔方建模与求解（Kociemba 两阶段算法）
 * 来源：npm cubejs@1.3.2（https://github.com/ldez/cubejs），MIT License。
 * 浏览器用法：<script src="vendor/cubejs/index.js"></script> → window.Cube
 */
(function (root) {
  var Cube = require('./lib/cube');
  require('./lib/solve');
  root.Cube = Cube;
})(typeof self !== 'undefined' ? self : this);
