/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

/**
 * Static analysis for Polymer.
 * @namespace hydrolysis
 */
export {Analyzer} from './analyzer';
export {FetchUrlLoader} from './url-loader/fetch-url-loader';

import * as _docs from './ast-utils/docs';
import * as _jsdoc from './ast-utils/jsdoc';

export let docs = _docs;
export let jsdoc = _jsdoc;
