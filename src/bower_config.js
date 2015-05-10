/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var path = require('path');
var fs = require('fs');

function bowerConfigPath(root) {
  root = path.join(process.cwd(), root || '.');
  return path.resolve(root, 'bower.json');
}

function bowerConfigContents(root) {
  var contents;

  try {
    contents = fs.readFileSync(bowerConfigPath(root));
  } catch (e) {
    console.error('Error reading config at ' + bowerConfigPath());
    console.error(e);
  }

  return contents || '{}';
}

function bowerConfig(root) {
  try {
    return JSON.parse(bowerConfigContents(root));
  } catch (e) {
    console.error('Could not parse bower.json');
    console.error(e);
  }

  return {};
}

module.exports = bowerConfig;
