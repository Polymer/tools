/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http:polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http:polymer.github.io/AUTHORS.txt The complete set of contributors may be
 * found at http:polymer.github.io/CONTRIBUTORS.txt Code distributed by Google
 * as part of the polymer project is also subject to an additional IP rights
 * grant found at http:polymer.github.io/PATENTS.txt
 */
// x-browser compat.
(function() {
let wcr = false;

addEventListener('WebComponentsReady', function() {
  wcr = true;
});

console.perf = function() {
  if (window.HTMLImports && !HTMLImports.useNative && !wcr) {
    let fn = console._perf.bind(console);
    HTMLImports.whenReady(fn);
  } else {
    console._perf();
  }
};

console._perf = function() {
  if (window.gc) {
    for (let i = 0; i < 20; i++) {
      gc();
    }
  }
  if (console.time) {
    console.time('perf');
  }
  console.perf.time = performance.now();
};

console.perfEnd = function(info) {
  if (window.WebComponents) {
    if (!wcr) {
      addEventListener('WebComponentsReady', function() {
        console._perfEnd(info);
      });
    } else {
      console._perfEnd(info);
    }
  } else {
    console._perfEnd(info);
  }
};

console._perfEnd = function(info, options = {}) {
  if (!options.skipForceLayout) {
    // force layout
    document.body.offsetWidth;
  }
  window.perfTiming = performance.now() - console.perf.time;
  if (console.time) {
    console.timeEnd('perf');
  }
  document.title = window.perfTiming.toFixed(1) + 'ms: ' + document.title;
  if (window.top !== window) {
    window.top.postMessage({time: window.perfTiming + 'ms', info}, '*');
  }
};

})();
