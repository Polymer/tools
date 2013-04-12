/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {

// utility method

function findScript(inFileName) {
  var script = null;
  var re = new RegExp(inFileName + '[^\\\\]*');
  var s$ = document.querySelectorAll('script[src]');
  Array.prototype.forEach.call(s$, function(s) {
    var src = s.getAttribute('src');
    var match = src.match(re);
    if (match) {
      s.basePath = src.slice(0, -match[0].length);
      script = s;
    }
  });
  return script;
}

// get arguments

var thisFile = 'loader.js';
var names = findScript(thisFile).attributes;

// acquire scope from 'scope' attribute on 'loader.js' script tag

var scope = window[names.scope.value] || window;
if (!scope) {
  scope = window[names.scope.value] = {};
}

// imports

var entryPointName = scope.entryPointName;
var processFlags = scope.processFlags;

// acquire attributes and base path from entry point

var entryPoint = findScript(entryPointName);
var base = entryPoint.basePath;

// convert attributes to flags

var flags = {};
for (var i=0, a; (a=entryPoint.attributes[i]); i++) {
  flags[a.name] = a.value || true;
}

// convert url arguments to flags

if (!flags.noOpts) {
  location.search.slice(1).split('&').forEach(function(o) {
    o = o.split('=');
    o[0] && (flags[o[0]] = o[1] || true);
  });
}

// process global logFlags

var logFlags = window.logFlags || {};

var logFlags = {};
if (flags.log) {
  flags.log.split(',').forEach(function(f) {
    logFlags[f] = true;
  });
}

window.logFlags = logFlags;

// exports

scope.basePath = base;
scope.flags = flags;

// process flags for dynamic dependencies

if (processFlags) {
  processFlags.call(scope, flags);
}

// post-process imports

var modules = scope.modules || [];
var sheets = scope.sheets || [];

// write script tags for dependencies

modules.forEach(function(inSrc) {
  document.write('<script src="' + base + inSrc + '"></script>');
});

// write link tags for styles

sheets.forEach(function(inSrc) {
  document.write('<link rel="stylesheet" href="' + base + inSrc + '">');
});

})();
