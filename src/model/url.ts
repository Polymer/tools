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
 * These are a set of entirely-compile time types, used to help us manage the
 * lifecycle of a URL in the system, to ensure that we primarily deal with
 * canonical urls internally in the project.
 *
 * These types should be project-level concerns and should not impact users.
 */

/**
 * A URL that is either absolute, or relative to a certain file.
 *
 * This is mostly used to type urls extracted from import statements taken
 * directly out of documents. For example, in `import * as foo from "./foo.js"`
 * `./foo.js` is relative to the containing document.
 */
export type FileRelativeUrl = string&FileRelativeUrlBrand;

/**
 * A URL that is either absolute, or relative to the base of the package.
 *
 * This is the assumed format of user input to Analyzer methods.
 *
 * Use ScannedImport.resolveUrl to transform a FileRelativeUrl to a
 * PackageRelativeUrl.
 */
export type PackageRelativeUrl = string&PackageRelativeUrlBrand;

/**
 * A URL that has been resolved to its canonical and loadable form, by passing
 * through the project's URL Resolver.
 *
 * Use AnalysisContext#resolveUrl to transform a PackageRelativeUrl to a
 * ResolvedUrl.
 */
export type ResolvedUrl = string&ResolvedUrlBrand;


// Declare these as classes rather than interfaces so that the properties
// can be private.
export declare class ResolvedUrlBrand { private ResolvedUrlBrand: never; }

export declare class PackageRelativeUrlBrand {
  private PackageRelativeUrlBrand: never;
}

export declare class FileRelativeUrlBrand {
  private FileRelativeUrlBrand: never;
}
