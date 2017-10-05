/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {posix as path} from 'path';
import {Document} from 'polymer-analyzer';

import {dependencyMap} from './manifest-converter';

const htmlExtension = '.html';

/** A package-rooted URL path to a document; format returned by the analyzer */
export type OriginalDocumentUrl = string&{_OriginalDocumentUrl: never};
/** A package-rooted URL path to a converted document/module; './'-prefixed */
export type ConvertedDocumentUrl = string&{_ConvertedDocumentUrl: never};

/**
 * Given an HTML url relative to the project root, return true if that url
 * points to a bower dependency file.
 */
function isBowerDependencyUrl(htmlUrl: OriginalDocumentUrl): boolean {
  return htmlUrl.startsWith('bower_components/') ||
      htmlUrl.startsWith('./bower_components/');
}

/**
 * Rewrite a url to replace a `.js` file extension with `.html`.
 */
function fixHtmlExtension(htmlUrl: string): string {
  return htmlUrl.substring(0, htmlUrl.length - htmlExtension.length) + '.js';
}

/**
 * Update a bower package name in a url (at path index) to its matching npm
 * package name.
 */
function convertBowerDependencyUrl(dependencyUrl: OriginalDocumentUrl):
    ConvertedDocumentUrl {
  // Convert component folder name
  let jsUrl = dependencyUrl.replace('bower_components/', 'node_modules/');
  // Convert package name
  const jsUrlPieces = jsUrl.split('/');
  const bowerPackageName = jsUrlPieces[1];
  const mappingInfo = dependencyMap[bowerPackageName];
  if (mappingInfo) {
    jsUrlPieces[1] = mappingInfo.npm;
  } else {
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  jsUrl = jsUrlPieces.join('/');

  return jsUrl as ConvertedDocumentUrl;
}

/**
 * Return a document url property as a OriginalDocumentUrl type.
 */
export function getDocumentUrl(document: Document): OriginalDocumentUrl {
  return document.url as OriginalDocumentUrl;
}

/**
 * Converts an HTML Import path to a JS module path.
 */
export function convertHtmlDocumentUrl(htmlUrl: OriginalDocumentUrl):
    ConvertedDocumentUrl {
  // TODO(fks): This can be removed later if type-checking htmlUrl is enough
  if (htmlUrl.startsWith('.') || htmlUrl.startsWith('/')) {
    throw new Error(
        `convertDocumentUrl() expects an OriginalDocumentUrl string` +
        `from the analyzer, but got "${htmlUrl}"`);
  }
  // Start the creation of your converted URL, based on on the original URL
  let jsUrl = (<ConvertedDocumentUrl>(<string>htmlUrl));
  // If url points to a bower_components dependency, update it to point to
  // its equivilent node_modules npm dependency.
  if (isBowerDependencyUrl(htmlUrl)) {
    jsUrl = convertBowerDependencyUrl(htmlUrl);
  }

  // Temporary workaround for imports of some shadycss files that wrapped
  // ES6 modules.
  if (jsUrl.endsWith('shadycss/apply-shim.html')) {
    jsUrl = jsUrl.replace(
                'shadycss/apply-shim.html',
                'shadycss/entrypoints/apply-shim.js') as ConvertedDocumentUrl;
  }
  if (jsUrl.endsWith('shadycss/custom-style-interface.html')) {
    jsUrl = jsUrl.replace(
                'shadycss/custom-style-interface.html',
                'shadycss/entrypoints/custom-style-interface.js') as
        ConvertedDocumentUrl;
  }

  // Convert all HTML URLs to point to JS equivilent
  if (jsUrl.endsWith(htmlExtension)) {
    jsUrl = fixHtmlExtension(jsUrl) as ConvertedDocumentUrl;
  }
  // TODO(fks): Revisit this format? The analyzer returns URLs without this
  return ('./' + jsUrl) as ConvertedDocumentUrl;
}

export function convertJsDocumentUrl(oldUrl: OriginalDocumentUrl):
    ConvertedDocumentUrl {
  // TODO(fks): This can be removed later if type-checking htmlUrl is enough
  if (oldUrl.startsWith('.') || oldUrl.startsWith('/')) {
    throw new Error(
        `convertDocumentUrl() expects an OriginalDocumentUrl string` +
        `from the analyzer, but got "${oldUrl}"`);
  }
  let newUrl: string = oldUrl;
  // If url points to a bower_components dependency, update it to point to
  // its equivilent node_modules npm dependency.
  if (isBowerDependencyUrl(oldUrl)) {
    newUrl = convertBowerDependencyUrl(oldUrl);
  }

  // TODO(fks): Revisit this format? The analyzer returns URLs without this
  return ('./' + newUrl) as ConvertedDocumentUrl;
}

/**
 * Gets a relative URL from one JS module URL to another. Handles expected
 * formatting and relative/absolute urls.
 */
export function getRelativeUrl(
    fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl): string {
  // Error: Expects two package-root-relative URLs to compute a relative path
  if (!fromUrl.startsWith('./') || !toUrl.startsWith('./')) {
    throw new Error(
        `paths relative to package root expected (actual: ` +
        `from="${fromUrl}", to="${toUrl}")`);
  }
  let moduleJsUrl = path.relative(path.dirname(fromUrl), toUrl);
  // Correct URL format to add './' preface if none exists
  if (!moduleJsUrl.startsWith('.') && !moduleJsUrl.startsWith('/')) {
    moduleJsUrl = './' + moduleJsUrl;
  }
  return moduleJsUrl;
}
