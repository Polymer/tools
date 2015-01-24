/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
var selenium  = require('selenium-standalone');

var BASE_VERSION   = '2.44.0';
var CHROME_VERSION = '2.13';

// Cross-platform drivers.
var drivers = {
  chrome: {
    version: CHROME_VERSION,
    arch:    process.arch,
  },
};

if (process.platform === 'win32') {
  drivers.ie = {
    version: BASE_VERSION,
    arch:    process.arch,
  };
}

var config = {
  version: BASE_VERSION,
  drivers: drivers,
  logger:  console.log.bind(console),
}

selenium.install(config, function(error) {
  if (error) {
    console.log(error)
    proess.exit(1);
  }
});
