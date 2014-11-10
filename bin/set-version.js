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
var path = require('path');
var VALID_VERSION = /^\d\.\d\.\d$/;

var file = process.argv[2];
var version = process.argv[3];
var range = process.argv[4];

if (!file) {
  console.error("No file!");
  process.exit(1);
}

if (!version) {
  console.error("No version!");
  process.exit(1);
}

if (!range) {
  console.error("No range!");
  process.exit(1);
}

var config = require(path.resolve(file));

if (version && VALID_VERSION.test(version)) {
  config.version = version;
}

var deps = config.dependencies;
if (deps) {
  Object.keys(deps).forEach(function(d) {
    if (deps[d].search('Polymer.*/') > -1) {
      deps[d] = deps[d].replace(/#.*$/, '#' + range);
    }
  });
  config.dependencies = deps;
}

fs.writeFileSync(file, JSON.stringify(config, null, 2));
