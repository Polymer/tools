/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

module.exports = {
  hydrolyze:   require('./lib/hydrolyze'),
  importParse: require('./lib/ast-utils/import-parse'),
  jsdoc:       require('./lib/ast-utils/jsdoc'),
  jsParse:     require('./lib/ast-utils/js-parse'),
  loader:      require('./lib/loader/file-loader'),
  fsResolver:  require('./lib/loader/fs-resolver'),
  urlResolver: require('./lib/loader/url-resolver'),
  xhrResolver: require('./lib/loader/xhr-resolver')
};
