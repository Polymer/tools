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


import {JsModuleScanResult, ScanResult} from './document-scanner';
import {JsExport} from './js-module';
import {PackageScanExports, PackageScanFiles} from './package-scanner';
import {OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';

type FileExportJson = {
  [originalExportId: string]: string
};
interface PackageFileJson {
  convertedUrl: string;
  exports: FileExportJson;
}
type PackageFilesJson = {
  [originalFilePath: string]: null|PackageFileJson
};
export interface PackageScanResultJson {
  files: PackageFilesJson;
}

function filterExportsByFile(
    scanResult: JsModuleScanResult,
    exportsMap: PackageScanExports): FileExportJson {
  const fileExports: FileExportJson = {};
  for (const exportData of scanResult.exportMigrationRecords) {
    const globalExport = exportsMap.get(exportData.oldNamespacedName);
    if (globalExport !== undefined) {
      fileExports[exportData.oldNamespacedName] = globalExport.name;
    }
  }
  return fileExports;
}

/**
 * Convert a single file scan result to a serializable JSON object.
 */
function serializePackageFileScanResult(
    fileScanResult: ScanResult,
    exportsMap: PackageScanExports,
    urlHandler: UrlHandler): PackageFileJson|null {
  if (fileScanResult.type === 'delete-file') {
    return null;
  }
  const {convertedFilePath} = fileScanResult;
  const convertedRelativePath =
      urlHandler.convertedDocumentFilePathToPackageRelative(convertedFilePath);
  if (fileScanResult.type === 'html-document') {
    return {
      convertedUrl: convertedRelativePath,
      exports: {},
    };
  }
  return {
    convertedUrl: convertedRelativePath,
    exports: filterExportsByFile(fileScanResult, exportsMap),
  };
}

/**
 * Convert a map of files to a serializable JSON object.
 */
export function serializePackageScanResult(
    filesMap: PackageScanFiles,
    exportsMap: PackageScanExports,
    urlHandler: UrlHandler): PackageScanResultJson {
  const files: PackageFilesJson = {};
  for (const [originalFilePath, scanResult] of filesMap) {
    const originalRelativeUrl =
        urlHandler.originalUrlToPackageRelative(originalFilePath);
    files[originalRelativeUrl] =
        serializePackageFileScanResult(scanResult, exportsMap, urlHandler);
  }
  return {files};
}

function fileMappingToScanResult(
    originalPackageName: string,
    convertedPackageName: string,
    originalUrl: OriginalDocumentUrl,
    fileData: PackageFileJson|null,
    urlHandler: UrlHandler): ScanResult {
  if (fileData === null) {
    return {
      type: 'delete-file',
      originalUrl: originalUrl,
      convertedUrl: undefined,
      convertedFilePath: undefined,
    };
  }
  const convertedUrl = urlHandler.packageRelativeToConvertedUrl(
      convertedPackageName, fileData.convertedUrl);
  const convertedFilePath =
      urlHandler.packageRelativeConvertedUrlToConvertedDocumentFilePath(
          originalPackageName, fileData.convertedUrl);
  if (convertedUrl.endsWith('.html')) {
    return {
      type: 'html-document',
      originalUrl: originalUrl,
      convertedUrl: convertedUrl,
      convertedFilePath: convertedFilePath,
    };
  }
  return {
    type: 'js-module',
    originalUrl: originalUrl,
    convertedUrl: convertedUrl,
    convertedFilePath: convertedFilePath,
    exportMigrationRecords:
        Object.entries(fileData.exports).map(([exportId, exportName]) => ({
                                               oldNamespacedName: exportId,
                                               es6ExportName: exportName,
                                             })),
  };
}

export function filesJsonObjectToMap(
    originalPackageName: string,
    convertedPackageName: string,
    conversionManifest: PackageScanResultJson,
    urlHandler: UrlHandler): [PackageScanFiles, PackageScanExports] {
  const filesMap: PackageScanFiles = new Map();
  const exportsMap: PackageScanExports = new Map();
  for (const [relativeFromUrl, fileData] of Object.entries(
           conversionManifest.files)) {
    const originalUrl = urlHandler.packageRelativeToOriginalUrl(
        originalPackageName, relativeFromUrl);
    const scanResult = fileMappingToScanResult(
        originalPackageName,
        convertedPackageName,
        originalUrl,
        fileData,
        urlHandler);
    filesMap.set(originalUrl, scanResult);
  }
  for (const scanResult of filesMap.values()) {
    if (scanResult.type !== 'js-module') {
      continue;
    }
    for (const namespacedExports of scanResult.exportMigrationRecords) {
      exportsMap.set(
          namespacedExports.oldNamespacedName,
          new JsExport(
              scanResult.convertedUrl, namespacedExports.es6ExportName));
    }
  }
  return [filesMap, exportsMap];
}
