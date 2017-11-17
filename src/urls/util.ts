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

import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './types';

/**
 * Return true if url is formatted correctly as a OriginalDocumentUrl.
 * All ConvertedDocumentUrls have a `./` prefix, while OriginalDocumentUrl
 * (returned from the Analyzer) has no such prefix.
 */
export function isOriginalDocumentUrlFormat(url: string): boolean {
  return !url.startsWith('./');
}

/**
 * Rewrite a url to replace a `.html` file extension with `.js`, if found.
 */
export function replaceHtmlExtensionIfFound(url: string): string {
  return url.replace(/\.html$/, '.js');
}

/**
 * Create a ConvertedDocumentFilePath for the OriginalDocumentUrl of a document
 * being converted to a JS module.
 */
export function getJsModuleConvertedFilePath(originalUrl: OriginalDocumentUrl):
    ConvertedDocumentFilePath {
  return replaceHtmlExtensionIfFound(originalUrl) as ConvertedDocumentFilePath;
}

/**
 * Create a ConvertedDocumentFilePath for the OriginalDocumentUrl of a document
 * being converted to a top-level HTML document. (Note that this is a no-op
 * since HTML documents should keep their current html file extension).
 */
export function getHtmlDocumentConvertedFilePath(
    originalUrl: OriginalDocumentUrl): ConvertedDocumentFilePath {
  return originalUrl as string as ConvertedDocumentFilePath;
}

/**
 * Return a document url property as a OriginalDocumentUrl type.
 */
export function getDocumentUrl(document: Document): OriginalDocumentUrl {
  return document.url as OriginalDocumentUrl;
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


function dashToCamelCase(s: string) {
  return s.replace(/-[a-z]/g, (m) => m[1].toUpperCase());
}

/**
 * Get the import name for an imported module object. Useful when generating an
 * import statement, or a reference to an imported module object.
 */
export function getModuleId(url: string) {
  const baseName = path.basename(url);
  const lastDotIndex = baseName.lastIndexOf('.');
  const mainName = baseName.substring(0, lastDotIndex);
  return dashToCamelCase(mainName);
}
