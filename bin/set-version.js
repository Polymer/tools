/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

/*
 * Expected Structure:
 *   {
 *     "name": "foo",
 *     "version: "0.0.1",
 *     "dependencies": {
 *       "foo": "Polymer/foo#master"
 *     }
 *   }
 */
var fs = require('fs');
var VALID_VERSION = /^\d\.\d\.\d$/;

var file = process.argv[2];
var version = process.argv[3];

if (!file) {
  console.error("No file!");
  process.exit(1);
}

if (!version) {
  console.error("No version!");
  process.exit(1);
}

var configBlob = fs.readFileSync(file, 'utf8');
var config = JSON.parse(configBlob);

if (version && VALID_VERSION.test(version)) {
  config.version = version;
}

var deps = config.dependencies;
if (deps) {
  Object.keys(deps).forEach(function(d) {
    if (deps[d].search('Polymer.*/') > -1) {
      deps[d] = deps[d].replace(/#.*$/, '#' + version);
    }
  });
  config.dependencies = deps;
}

fs.writeFileSync(file, JSON.stringify(config, null, 2));
