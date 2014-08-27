/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// recursive module loader
var fs = require('fs');
var path = require('path');

function readJSON(filename) {
  var blob = fs.readFileSync(filename, 'utf8');
  return JSON.parse(blob);
}

function readManifest(filename, modules) {
  modules = modules || [];
  var lines = readJSON(filename);
  var dir = path.dirname(filename);
  lines.forEach(function(line) {
    var fullpath = path.join(dir, line);
    if (line.slice(-5) == '.json') {
      // recurse
      readManifest(fullpath, modules);
    } else {
      modules.push(fullpath);
    }
  });
  return modules;
}

module.exports = readManifest;
