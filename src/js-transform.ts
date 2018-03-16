/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as babelCore from 'babel-core';
import {ModuleResolutionStrategy} from 'polymer-project-config';
import * as uuid from 'uuid/v1';

import {resolveBareSpecifiers} from './babel-plugin-bare-specifiers';

// TODO(aomarks) Switch to babel-preset-env. But how do we get just syntax
// plugins without turning on transformation, for the case where we are
// minifying but not compiling?
const babelSyntaxPlugins = [
  require('babel-plugin-syntax-dynamic-import'),
  require('babel-plugin-syntax-object-rest-spread'),
];
const babelPresetMinify =
    require('babel-preset-minify')({}, {simplifyComparisons: false});
const babelPresetES2015NoModules =
    require('babel-preset-es2015').buildPreset({}, {modules: false});
const babelPluginExternalHelpers = require('babel-plugin-external-helpers');
const babelTransformPluginObjectRestSpread =
    require('babel-plugin-transform-object-rest-spread');
const babelTransformModulesAmd =
    require('babel-plugin-transform-es2015-modules-amd');

/**
 * Options for jsTransform.
 */
export interface JsTransformOptions {
  // Whether to compile JavaScript to ES5.
  compileToEs5?: boolean;
  // Whether to minify JavaScript.
  minify?: boolean;
  // What kind of ES module resolution/remapping to apply.
  moduleResolution?: ModuleResolutionStrategy;
  // The path of the file being transformed, used for module resolution.
  filePath?: string;
  // For Polyserve or other servers with similar component directory mounting
  // behavior. Whether this is a request for a package in node_modules/.
  isComponentRequest?: boolean;
  // Whether to replace ES modules with AMD modules.
  transformEsModulesToAmd?: boolean;
}

/**
 * Transform some JavaScript according to the given options.
 */
export function jsTransform(js: string, options: JsTransformOptions): string {
  // Even with no transform plugins, parsing and serializing with Babel will
  // make some minor formatting changes to the code. Skip Babel altogether
  // if we have no meaningful changes to make.
  let doBabel = false;

  // Note that Babel plugins run in this order:
  // 1) plugins, first to last
  // 2) presets, last to first
  const plugins = [...babelSyntaxPlugins];
  const presets = [];

  if (options.minify) {
    doBabel = true;
    // Minify last, so push first.
    presets.push(babelPresetMinify);
  }
  if (options.compileToEs5) {
    doBabel = true;
    presets.push(babelPresetES2015NoModules);
    plugins.push(
        babelPluginExternalHelpers,
        babelTransformPluginObjectRestSpread,
    );
  }
  if (options.moduleResolution === 'node') {
    if (!options.filePath) {
      throw new Error(
          'Cannot perform node module resolution without filePath.');
    }
    doBabel = true;
    plugins.push(
        resolveBareSpecifiers(options.filePath, options.isComponentRequest));
  }
  if (options.transformEsModulesToAmd) {
    doBabel = true;
    plugins.push(babelTransformModulesAmd);
  }

  if (doBabel) {
    js = babelCore.transform(js, {presets, plugins}).code!;
  }
  js = replaceTemplateObjectNames(js);
  return js;
}

/**
 * Modifies variables names of tagged template literals (`"_templateObject"`)
 * from a given string so that they're all unique.
 *
 * This is needed to workaround a potential naming collision when individually
 * transpiled scripts are bundled. See #950.
 */
function replaceTemplateObjectNames(js: string): string {
  // Breakdown of regular expression to match "_templateObject" variables
  //
  // Pattern                | Meaning
  // -------------------------------------------------------------------
  // (                      | Group1
  // _templateObject        | Match "_templateObject"
  // \d*                    | Match 0 or more digits
  // \b                     | Match word boundary
  // )                      | End Group1
  const searchValueRegex = /(_templateObject\d*\b)/g;

  // The replacement pattern appends an underscore and UUID to the matches:
  //
  // Pattern                | Meaning
  // -------------------------------------------------------------------
  // $1                     | Insert matching Group1 (from above)
  // _                      | Insert "_"
  // ${uniqueId}            | Insert previously generated UUID
  const uniqueId = uuid().replace(/-/g, '');
  const replaceValue = `$1_${uniqueId}`;

  // Example output:
  // _templateObject  -> _templateObject_200817b1154811e887be8b38cea68555
  // _templateObject2 -> _templateObject2_5e44de8015d111e89b203116b5c54903

  return js.replace(searchValueRegex, replaceValue);
}
