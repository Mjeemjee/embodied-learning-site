/* 本课固定 Python 示例的轻量演示器。不是通用 Python 解释器。 */
(function (root) {
  'use strict';
  function convertLine(line) {
    if (/^\s*#/.test(line)) return line.replace(/^(\s*)#\s?/, '$1// ');
    if (/^\s*import math\s*$/.test(line)) return '// math is provided by the demo runtime';
    // Protect quoted text: words such as "and" inside strings are not operators.
    var strings = [];
    var s = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, function (v) {
      strings.push(v); return '___STR' + (strings.length - 1) + '___';
    });
    s = s.replace(/([\p{L}\p{N}_\]\[).]+)\s*\/\/\s*([\p{L}\p{N}_(]+)/gu, 'Math.floor($1 / $2)');
    s = s.replace(/\bprint\s*\(/g, 'console.log(')
      .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
      .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\s+/g, '!');
    s = s.replace(/^(\s*)elif\s+(.+?)\s*:\s*$/, '$1else if ($2) {')
      .replace(/^(\s*)if\s+(.+?)\s*:\s*$/, '$1if ($2) {')
      .replace(/^(\s*)else\s*:\s*$/, '$1else {')
      .replace(/^(\s*)for\s+(.+?)\s+in\s+(.+?)\s*:\s*$/, '$1for (var $2 of $3) {')
      .replace(/^(\s*)while\s+(.+?)\s*:\s*$/, '$1while ($2) {')
      .replace(/^(\s*)def\s+([^\s(]+)\s*\(([^)]*)\)\s*:\s*$/, '$1function $2($3) {')
      .replace(/\.append\(/g, '.push(')
      .replace(/^(\s*)([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)/u, '$1var $2 =');
    return s.replace(/___STR(\d+)___/g, function (_, n) { return strings[Number(n)]; });
  }
  function pyToJs(code) {
    var stack = [], out = [];
    code.split('\n').forEach(function (raw) {
      if (!raw.trim() || /^\s*#/.test(raw)) { out.push(convertLine(raw)); return; }
      var indent = raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      while (stack.length && indent <= stack[stack.length - 1]) { stack.pop(); out.push('}'); }
      var js = convertLine(raw); out.push(js);
      if (/\{\s*$/.test(js)) stack.push(indent);
    });
    while (stack.length) { stack.pop(); out.push('}'); }
    return out.join('\n');
  }
  function format(v) {
    if (v === null) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (Array.isArray(v)) return '[' + v.map(function (x) { return typeof x === 'string' ? "'" + x + "'" : format(x); }).join(', ') + ']';
    if (typeof v === 'number' && Number.isFinite(v)) return String(Number(v.toFixed(9)));
    return String(v);
  }
  function execute(code) {
    var logs = [];
    var print = function () { logs.push(Array.prototype.map.call(arguments, format).join(' ')); };
    function range(a, b, step) {
      if (b === undefined) { b = a; a = 0; }
      step = step === undefined ? 1 : step;
      if (!Number.isFinite(step) || step === 0) throw new Error('range() 的步长不能为 0');
      var values = [];
      for (var i = a; step > 0 ? i < b : i > b; i += step) {
        if (values.length >= 10000) throw new Error('演示循环超过 10000 次，请缩小范围');
        values.push(i);
      }
      return values;
    }
    var math = { pi: Math.PI, e: Math.E, sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, radians: function (x) { return x * Math.PI / 180; } };
    var args = {
      console: { log: print }, Math: Math, math: math, print: print,
      int: function (x) { return Math.trunc(Number(x)); }, float: Number, str: format,
      len: function (x) { return x.length; }, range: range,
      list: function (x) { return x === undefined ? [] : Array.from(x); }, abs: Math.abs,
      min: function () { return Math.min.apply(null, Array.isArray(arguments[0]) ? arguments[0] : arguments); },
      max: function () { return Math.max.apply(null, Array.isArray(arguments[0]) ? arguments[0] : arguments); },
      round: function (x, n) { var f = Math.pow(10, n || 0); return Math.round((x + Number.EPSILON) * f) / f; },
      sum: function (a) { return a.reduce(function (x, y) { return x + y; }, 0); }
    };
    var names = Object.keys(args);
    var fn = new Function(names.join(','), '"use strict";\n' + pyToJs(code));
    fn.apply(null, names.map(function (k) { return args[k]; }));
    return logs;
  }
  root.DemoRuntime = { convertLine: convertLine, pyToJs: pyToJs, execute: execute };
  if (typeof module !== 'undefined') module.exports = root.DemoRuntime;
})(typeof self !== 'undefined' ? self : globalThis);
