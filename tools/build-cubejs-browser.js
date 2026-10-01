/*
 * 把 vendor/cubejs（CommonJS）打包成浏览器可直接 <script> 引入的 UMD 文件。
 * 生成 web/vendor/cubejs/cubejs.browser.js，挂 window.Cube。
 * 用法：node tools/build-cubejs-browser.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'vendor', 'cubejs');
const OUT = path.join(__dirname, '..', 'web', 'vendor', 'cubejs', 'cubejs.browser.js');

/** 模块文件列表（按依赖顺序） */
const FILES = ['cube.js', 'solve.js'];

/** 把每个 CommonJS 文件包进工厂函数 */
function wrapFile(name) {
  let code = fs.readFileSync(path.join(SRC, 'lib', name), 'utf8');
  /*
   * cubejs 源码用 `this.Cube` 判断运行环境（`this.Cube = ...` / `this.Cube || require(...)`）。
   * 打包后模块函数在严格模式下执行，`this` 为 undefined，会直接抛错。
   * 这里把该写法重写成对模块表的显式引用，行为完全等价且与运行环境无关。
   */
  if (name === 'solve.js') code = code.replace(/this\.Cube/g, "__cubejs_module('cube')");
  return '/* ===== cubejs: lib/' + name + ' ===== */\n'
    + '__define(' + JSON.stringify(name) + ', function (require, module, exports) {\n'
    + code + '\n});\n';
}

const HEADER = [
  '/*',
  ' * cubejs — 3x3x3 魔方建模与求解（Kociemba 两阶段算法）',
  ' * 来源：npm cubejs@1.3.2（https://github.com/ldez/cubejs），MIT License。',
  ' * 本文件由 tools/build-cubejs-browser.js 自动生成，请勿手改。',
  ' * 浏览器用法：<script src="vendor/cubejs/cubejs.browser.js"></script> → window.Cube',
  ' */',
  "(function (root) {",
  "  'use strict';",
  '  var __defs = {}, __cache = {};',
  '',
  "  /** 模块键规范化：'./lib/cube' / './cube' / 'cube.js' → 'cube' */",
  '  function __key(name) {',
  "    return String(name).replace(/^\\.\\//, '').replace(/^lib\\//, '').replace(/\\.js$/, '');",
  '  }',
  '  function __define(name, fn) { __defs[__key(name)] = fn; }',
  '  function __cubejs_module(name) { return __require(name); }',
  '  function __require(name) {',
  '    var key = __key(name);',
  '    if (__cache[key]) return __cache[key].exports;',
  "    if (!__defs[key]) throw new Error('cubejs: 未知模块 ' + name);",
  '    var mod = { exports: {} };',
  '    __cache[key] = mod;',
  '    var __fn = __defs[key];',
  '    __fn.call(globalThis, __require, mod, mod.exports);',
  '    return mod.exports;',
  '  }',
  '',
].join('\n');

const FOOTER = [
  '',
  "  __require('solve');          // 必须执行，它把 initSolver/solve 挂到 Cube 上",
  "  root.Cube = __require('cube');",
  "})(typeof self !== 'undefined' ? self : this);",
  '',
].join('\n');

const license = fs.readFileSync(path.join(SRC, 'LICENSE'), 'utf8');
const bundle = '/*\n' + license + '\n*/\n' + HEADER + wrapFile('cube.js') + wrapFile('solve.js') + FOOTER;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, bundle);
fs.writeFileSync(path.join(path.dirname(OUT), 'LICENSE'), license);
console.log('已生成', path.relative(path.join(__dirname, '..'), OUT), (bundle.length / 1024).toFixed(1) + ' KB');
