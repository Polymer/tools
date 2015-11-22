/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
 /*jslint node: true */
'use strict';
require("babel-polyfill");

/**
 * Static analysis for Polymer.
 * @namespace hydrolysis
 */
export {Analyzer} from './lib/Analyzer';
import * as _int_docs from './lib/ast-utils/docs';
export {FSResolver} from './lib/loader/fs-resolver';
import * as _int_jsdoc from './lib/ast-utils/jsdoc';
export {FileLoader as Loader} from './lib/loader/file-loader';
export {NoopResolver} from './lib/loader/noop-resolver';
export {RedirectResolver} from './lib/loader/redirect-resolver';
export {XHRResolver} from './lib/loader/xhr-resolver';
export {StringResolver} from './lib/loader/string-resolver';
export {jsParse as _jsParse} from './lib/ast-utils/js-parse';
export {importParse as _importParse} from './lib/ast-utils/import-parse';

export let docs = _int_docs;
export let jsdoc = _int_jsdoc;
