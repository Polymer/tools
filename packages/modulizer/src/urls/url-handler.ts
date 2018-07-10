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

import {Import} from 'polymer-analyzer';
import {Document} from 'polymer-analyzer/lib/model/document';

import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './types';


/**
 * This is the generic interface all URL Converters must implement to properly
 * handle modulization across different project layouts.
 *
 * See PackageUrlHandler, WorkspaceUrlHandler for example implementations.
 */
export interface UrlHandler {
  getDocumentUrl(document: Document|Import): OriginalDocumentUrl;
  isImportInternal(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl):
      boolean;
  getOriginalPackageNameForUrl(url: OriginalDocumentUrl): string;
  getNameImportUrl(url: ConvertedDocumentUrl): ConvertedDocumentUrl;
  getPathImportUrl(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl):
      string;
  convertUrl(url: OriginalDocumentUrl): ConvertedDocumentUrl;
  createConvertedUrl(partialUrl: string): ConvertedDocumentUrl;

  originalUrlToPackageRelative(url: OriginalDocumentUrl): string;
  convertedUrlToPackageRelative(url: ConvertedDocumentUrl): string;
  convertedDocumentFilePathToPackageRelative(url: ConvertedDocumentFilePath):
      string;

  packageRelativeToOriginalUrl(originalPackageName: string, url: string):
      OriginalDocumentUrl;
  packageRelativeToConvertedUrl(convertedPackageName: string, url: string):
      ConvertedDocumentUrl;
  packageRelativeToConvertedDocumentFilePath(packageName: string, url: string):
      ConvertedDocumentFilePath;
  packageRelativeConvertedUrlToConvertedDocumentFilePath(
      originalPackageName: string, url: string): ConvertedDocumentFilePath;

  getPackageDir(packageName: string): string;
}
