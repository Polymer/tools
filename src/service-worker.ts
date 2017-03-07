/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

/// <reference path="../custom_typings/sw-precache.d.ts" />

import {writeFile} from 'fs';
import * as path from 'path';
import * as logging from 'plylog';
import {generate as swPrecacheGenerate, SWConfig} from 'sw-precache';

import {DepsIndex} from './analyzer';
import {PolymerProject} from './polymer-project';

const logger = logging.getLogger('polymer-build.service-worker');

export interface AddServiceWorkerOptions {
  project: PolymerProject;
  buildRoot: string;
  bundled?: boolean;
  path?: string;
  swPrecacheConfig?: SWConfig|null;
}

/**
 * Given a user-provided AddServiceWorkerOptions object, check for deprecated
 * options. When one is found, warn the user and fix if possible.
 */
function fixDeprecatedOptions(options: any): AddServiceWorkerOptions {
  if (typeof options.serviceWorkerPath !== 'undefined') {
    logger.warn(
        '"serviceWorkerPath" config option has been renamed to "path" and will no longer be supported in future versions');
    options.path = options.path || options.serviceWorkerPath;
  }
  if (typeof options.swConfig !== 'undefined') {
    logger.warn(
        '"swConfig" config option has been renamed to "swPrecacheConfig" and will no longer be supported in future versions');
    options.swPrecacheConfig = options.swPrecacheConfig || options.swConfig;
  }
  return options;
}

/**
 * Returns an array of file paths for the service worker to precache, based on
 * the information provided in the DepsIndex object.
 */
function getPrecachedAssets(
    depsIndex: DepsIndex, project: PolymerProject): string[] {
  const precachedAssets = new Set<string>(project.config.allFragments);
  precachedAssets.add(project.config.entrypoint);

  for (let depImports of depsIndex.fragmentToFullDeps.values()) {
    depImports.imports.forEach((s) => precachedAssets.add(s));
    depImports.scripts.forEach((s) => precachedAssets.add(s));
    depImports.styles.forEach((s) => precachedAssets.add(s));
  }

  return Array.from(precachedAssets);
}

/**
 * Returns an array of file paths for the service worker to precache for a
 * BUNDLED build, based on the information provided in the DepsIndex object.
 */
function getBundledPrecachedAssets(project: PolymerProject) {
  const precachedAssets = new Set<string>(project.config.allFragments);
  precachedAssets.add(project.config.entrypoint);

  return Array.from(precachedAssets);
}

/**
 * Returns a promise that resolves with a generated service worker (the file
 * contents), based off of the options provided.
 */
export async function generateServiceWorker(options: AddServiceWorkerOptions):
    Promise<Buffer> {
  console.assert(!!options, '`project` & `buildRoot` options are required');
  console.assert(!!options.project, '`project` option is required');
  console.assert(!!options.buildRoot, '`buildRoot` option is required');
  options = fixDeprecatedOptions(options);

  options = Object.assign({}, options);
  const project = options.project;
  const buildRoot = options.buildRoot;
  const swPrecacheConfig: SWConfig =
      Object.assign({}, options.swPrecacheConfig);

  const depsIndex = await project.analyzer.analyzeDependencies;
  let staticFileGlobs = Array.from(swPrecacheConfig.staticFileGlobs || []);
  const precachedAssets = (options.bundled) ?
      getBundledPrecachedAssets(project) :
      getPrecachedAssets(depsIndex, project);

  staticFileGlobs = staticFileGlobs.concat(precachedAssets);
  staticFileGlobs = staticFileGlobs.map((filePath: string) => {
    if (filePath.startsWith(project.config.root)) {
      filePath = filePath.substring(project.config.root.length);
    }
    return path.join(buildRoot, filePath);
  });

  // swPrecache will determine the right urls by stripping buildRoot
  swPrecacheConfig.stripPrefix = buildRoot;
  // static files will be pre-cached
  swPrecacheConfig.staticFileGlobs = staticFileGlobs;
  // Log service-worker helpful output at the debug log level
  swPrecacheConfig.logger = swPrecacheConfig.logger || logger.debug;

  return await<Promise<Buffer>>(new Promise((resolve, reject) => {
    logger.debug(`writing service worker...`, swPrecacheConfig);
    swPrecacheGenerate(
        swPrecacheConfig, (err?: Error, fileContents?: string) => {
          if (err) {
            reject(err);
          } else {
            resolve(new Buffer(fileContents));
          }
        });
  }));
}


/**
 * Returns a promise that resolves when a service worker has been generated
 * and written to the build directory. This uses generateServiceWorker() to
 * generate a service worker, which it then writes to the file system based on
 * the buildRoot & path (if provided) options.
 */
export function addServiceWorker(options: AddServiceWorkerOptions):
    Promise<{}> {
  return generateServiceWorker(options).then((fileContents: Buffer) => {
    return new Promise((resolve, reject) => {
      const serviceWorkerPath =
          path.join(options.buildRoot, options.path || 'service-worker.js');
      writeFile(serviceWorkerPath, fileContents, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}
