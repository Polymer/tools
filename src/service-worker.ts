/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {writeFile} from 'fs';
import * as path from 'path';
import * as logging from 'plylog';
import {PolymerProject} from './polymer-project';
import {DepsIndex} from './analyzer';
import {SWConfig, generate as swPrecacheGenerate} from 'sw-precache';

let logger = logging.getLogger('polymer-build.service-worker');

export interface AddServiceWorkerOptions {
  project: PolymerProject;
  buildRoot: string;
  bundled?: boolean;
  serviceWorkerPath?: string;
  swConfig?: SWConfig;
}

/**
 * Parses a depsIndex object and returns an array of file paths, pointing to
 * the project's required service worker precached assets.
 */
function getPrecachedAssets(depsIndex: DepsIndex, project: PolymerProject): string[] {
  let precachedAssets = new Set<string>(project.analyzer.allFragments);
  precachedAssets.add(project.entrypoint);

  for (let dep of depsIndex.depsToFragments.keys()) {
    precachedAssets.add(dep);
  }
  for (let depImports of depsIndex.fragmentToFullDeps.values()) {
    depImports.scripts.forEach((s) => precachedAssets.add(s));
    depImports.styles.forEach((s) => precachedAssets.add(s));
  }
  return Array.from(precachedAssets);
}

/**
 * Parses a depsIndex object and returns an array of file paths for a BUNDLED
 * build, pointing to the project's required service worker precached assets.
 */
function getBundledPrecachedAssets(project: PolymerProject) {
  let precachedAssets = new Set<string>(project.analyzer.allFragments);
  precachedAssets.add(project.entrypoint);

  return Array.from(precachedAssets).concat(project.bundler.sharedBundleUrl);
}

/**
 * Returns a promise that resolves with a generated service worker (the file
 * contents), based off of the options provided.
 */
export function generateServiceWorker(options: AddServiceWorkerOptions): Promise<Buffer> {
  console.assert(!!options.project, '`project` option is required');
  console.assert(!!options.buildRoot, '`buildRoot` option is required');

  let project = options.project;
  let buildRoot = options.buildRoot;
  let swConfig: SWConfig = options.swConfig || {};

  return project.analyzer.analyzeDependencies.then((depsIndex: DepsIndex) => {
    let staticFileGlobs = swConfig.staticFileGlobs || [];
    let precachedAssets = (options.bundled)
      ? getBundledPrecachedAssets(project)
      : getPrecachedAssets(depsIndex, project);

    staticFileGlobs = staticFileGlobs.concat(precachedAssets);
    staticFileGlobs = staticFileGlobs.map((filePath: string) => {
      if (filePath.startsWith(project.root)) {
        filePath = filePath.substring(project.root.length);
      }
      return path.join(buildRoot, filePath);
    });

    // swPrecache will determine the right urls by stripping buildRoot
    swConfig.stripPrefix = buildRoot;
    // static files will be pre-cached
    swConfig.staticFileGlobs = staticFileGlobs;
    // Log service-worker helpful output at the debug log level
    swConfig.logger = swConfig.logger || logger.debug;

    return new Promise((resolve, reject) => {
      logger.debug(`writing service worker...`, swConfig);
      swPrecacheGenerate(swConfig, (err?: Error, fileContents?: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(new Buffer(fileContents));
        }
      });
    });
  });
}


/**
 * Returns a promise that resolves when a service worker has been generated
 * and written to the build directory. This uses generateServiceWorker() to
 * generate a service worker, which it then writes to the file system based on
 * the buildRoot & serviceWorkerPath (if provided) options.
 */
export function addServiceWorker(options: AddServiceWorkerOptions): Promise<{}> {
  return generateServiceWorker(options).then((fileContents: Buffer) => {
    return new Promise((resolve, reject) => {
      let serviceWorkerPath = path.join(options.buildRoot, options.serviceWorkerPath || 'service-worker.js');
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


