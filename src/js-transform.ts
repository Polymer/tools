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

import * as babelCore from '@babel/core';
import {relative} from 'path';
import {ModuleResolutionStrategy} from 'polymer-project-config';
import * as uuid from 'uuid/v1';

import {resolveBareSpecifiers} from './babel-plugin-bare-specifiers';
import {rewriteImportMeta} from './babel-plugin-import-meta';

import isWindows = require('is-windows');

// TODO(aomarks) Switch to babel-preset-env. But how do we get just syntax
// plugins without turning on transformation, for the case where we are
// minifying but not compiling?

// Syntax and transform plugins for ES2015.
const babelPresetEs2015NoModules =
    [require('@babel/preset-es2015'), {modules: false}];

// The ES2016 and ES2017 presets do not inherit the plugins of previous years,
// and there is no ES2018 preset yet. Since the additions in ES2016 and ES2017
// are small, and we have to list syntax plugins separately anyway (see below),
// just enumerate the transform plugins here instead of merging the 3 presets.
const babelTransformPlugins = [
  // Don't emit helpers inline.
  require('@babel/plugin-external-helpers'),
  // ES2016
  require('@babel/plugin-transform-exponentiation-operator'),
  // ES2017
  require('@babel/plugin-transform-async-to-generator'),
  // ES2018 (partial)
  require('@babel/plugin-proposal-object-rest-spread'),
  require('@babel/plugin-proposal-async-generator-functions'),
];

const babelTransformModulesAmd = require('@babel/plugin-transform-modules-amd');

// We enumerate syntax plugins that would automatically be loaded by our
// transform plugins because we need to support the configuration where we
// minify but don't compile, and don't want Babel to error when it encounters
// syntax that we support when compiling.
const babelSyntaxPlugins = [
  // ES2017 and below syntax plugins are included by default.
  // ES2018 (partial)
  require('@babel/plugin-syntax-object-rest-spread'),
  require('@babel/plugin-syntax-async-generators'),
  // Future
  // require('@babel/plugin-syntax-export-extensions'),
  require('@babel/plugin-syntax-dynamic-import'),
  require('@babel/plugin-syntax-import-meta'),
];

const babelPresetMinify =
    require('babel-preset-minify')({}, {simplifyComparisons: false});

/**
 * Options for jsTransform.
 */
export interface JsTransformOptions {
  // Whether to compile JavaScript to ES5.
  //
  // Note that some JavaScript features may require the Babel helper polyfills,
  // which this function will not insert and must be loaded separately.
  compileToEs5?: boolean;

  // Whether to minify JavaScript.
  minify?: boolean;

  // What kind of ES module resolution/remapping to apply.
  moduleResolution?: ModuleResolutionStrategy;

  // The path of the file being transformed, used for module resolution.
  // Must be an absolute filesystem path.
  filePath?: string;

  // The package name of the file being transformed, required when
  // `isComponentRequest` is true.
  packageName?: string;

  // For Polyserve or other servers with similar component directory mounting
  // behavior. Whether this is a request for a package in node_modules/.
  isComponentRequest?: boolean;

  // The component directory to use when rewriting bare specifiers to relative
  // paths. A resolved path that begins with the component directory will be
  // rewritten to be relative to the root.
  componentDir?: string;

  // The root directory of the package containing the component directory.
  // Must be an absolute filesystem path.
  rootDir?: string;

  // Whether to rewrite `import.meta` expressions to objects with inline URLs.
  transformImportMeta?: boolean;

  // Whether to replace ES modules with AMD modules.
  transformEsModulesToAmd?: boolean;

  // If transformEsModulesToAmd is true, setting this option will update the
  // generated AMD module to be 1) defined with an auto-generated name (instead
  // of with no name), and 2) if > 0, to depend on the previously auto-generated
  // module. This can be used to generate a dependency chain between module
  // scripts.
  moduleScriptIdx?: number;

  // If true, parsing of invalid JavaScript will not throw an exception.
  // Instead, a console error will be logged, and the original JavaScript will
  // be returned with no changes. Use with caution!
  softSyntaxError?: boolean;
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
    presets.push(babelPresetEs2015NoModules);
    plugins.push(...babelTransformPlugins);
  }
  if (options.moduleResolution === 'node') {
    if (!options.filePath) {
      throw new Error(
          'Cannot perform node module resolution without filePath.');
    }
    doBabel = true;
    plugins.push(resolveBareSpecifiers(
        options.filePath,
        !!options.isComponentRequest,
        options.packageName,
        options.componentDir,
        options.rootDir));
  }
  if (options.transformImportMeta) {
    if (!options.filePath) {
      throw new Error('Cannot perform importMeta transform without filePath.');
    }
    if (!options.rootDir) {
      throw new Error('Cannot perform importMeta transform without rootDir.');
    }
    doBabel = true;
    let relativeURL = relative(options.rootDir, options.filePath);
    if (isWindows()) {
      // normalize path separators to URL format
      relativeURL = relativeURL.replace(/\\/g, '/');
    }
    plugins.push(rewriteImportMeta(relativeURL));
  }
  if (options.transformEsModulesToAmd) {
    doBabel = true;
    plugins.push(babelTransformModulesAmd);
  }

  if (doBabel) {
    try {
      js = babelCore.transform(js, {presets, plugins}).code!;
    } catch (e) {
      if (options.softSyntaxError && e.constructor.name === 'SyntaxError') {
        console.error(
            'ERROR [polymer-build]: failed to parse JavaScript' +
                (options.filePath ? ` (${options.filePath}):` : ':'),
            e);
        return js;
      } else {
        throw e;
      }
    }
  }

  if (options.transformEsModulesToAmd &&
      options.moduleScriptIdx !== undefined) {
    const generatedModule = generateModuleName(options.moduleScriptIdx);
    const previousGeneratedModule = options.moduleScriptIdx === 0 ?
        undefined :
        generateModuleName(options.moduleScriptIdx - 1);
    const depStr = previousGeneratedModule === undefined ?
        '' :
        `'${previousGeneratedModule}', `;
    // The AMD Babel plugin will produce a `define` call with no name argument,
    // since it assumes its name corresponds to its file name. This is an inline
    // script, though, and we need a handle to it for chaining, so insert a name
    // argument.
    js = js.replace('define([', `define('${generatedModule}', [${depStr}`);
  }

  js = replaceTemplateObjectNames(js);

  return js;
}

export function generateModuleName(idx: number): string {
  return `polymer-build-generated-module-${idx}`;
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
