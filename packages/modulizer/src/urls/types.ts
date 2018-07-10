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


/**
 * A URL path to a document, pre-conversion. Always relative to the current
 * project layout (package, workspace, etc).
 */
export type OriginalDocumentUrl = string&{_OriginalDocumentUrl: never};

/**
 * A URL path to a document, post-conversion. Uses npm naming for all URLs
 * containing package names. Always relative to the current project layout
 * (package, workspace, etc).
 */
export type ConvertedDocumentUrl = string&{_ConvertedDocumentUrl: never};

/**
 * A file path to where a document will be written, post-conversion. Unlike
 * ConvertedDocumentUrl, this URL preserves the original package folder.
 * Useful in workspace layouts where converted files should still be written
 * to the original, analyzed repo.
 */
export type ConvertedDocumentFilePath =
    string&{_ConvertedDocumentFilePath: never};

/**
 * A valid "package type", informing how the converter formats implicit URLs.
 *
 * TODO(fks) 11-06-2017: Replace "package type" concept with more intelligent
 * URL formatting.
 */
export type PackageType = 'element'|'application';
