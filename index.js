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
  docs:         require('./lib/ast-utils/docs'),
  FSResolver:   require('./lib/loader/fs-resolver'),
  hydrolyze:    require('./lib/hydrolyze'),
  jsdoc:        require('./lib/ast-utils/jsdoc'),
  Loader:       require('./lib/loader/file-loader'),
  Monomers:     require('./lib/monomers'),
  NoopResolver: require('./lib/loader/noop-resolver'),
  URLResolver:  require('./lib/loader/url-resolver'),
  XHRResolver:  require('./lib/loader/xhr-resolver')
};
