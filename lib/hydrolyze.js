/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

var Monomers = require('./monomers');

/**
* Returns a metadata representation of `htmlImport`.
* @param  {String} htmlImport The raw text to process.
* @param  {[type]} attachAST  Whether elements should include their parse5 AST.
* @param  {[type]} href       The URL of this element.
* @param  {[type]} loader     A loader to load external resources. Without
*                             the `href` argument, this will fail.
* @param  {[type]} resolved   A `Map` containing all already resolved imports.
* @return {Object}            The hydrolyzed import.
*/
var hydrolyze = function hydrolyze(htmlImport,
                                   attachAST,
                                   href,
                                   loader,
                                   resolved) {
  var monomers = new Monomers(htmlImport,
                                   attachAST,
                                   href,
                                   loader);
  return monomers.metadataTree();
};

module.exports = hydrolyze;
