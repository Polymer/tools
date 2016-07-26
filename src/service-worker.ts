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
const swPrecache = require('sw-precache');

// non-ES compatible modules
let logger = logging.getLogger('polymer-build.service-worker');

export interface SWConfig {
  cacheId?: string;
  directoryIndex?: string;
  dynamicUrlToDependencies?: {
    [property: string]: string[]
  };
  handleFetch?: boolean;
  ignoreUrlParametersMatching?: RegExp[];
  importScripts?: string[];
  logger?: Function;
  maximumFileSizeToCacheInBytes?: number;
  navigateFallback?: string;
  navigateFallbackWhitelist?: RegExp[];
  replacePrefix?: string;
  runtimeCaching?: {
    urlPattern: RegExp;
    handler: string;
    options?: {
      cache: {
        maxEntries: number;
        name: string;
      };
    };
  }[];
  staticFileGlobs?: string[];
  stripPrefix?: string;
  templateFilePath?: string;
  verbose?: boolean;
}

export interface AddServiceWorkerOptions {
  project: PolymerProject;
  buildRoot: string;
  bundled?: boolean;
  serviceWorkerPath?: string;
  swConfig?: SWConfig;
}

function getPrecachedAssets(depsIndex: DepsIndex, project: PolymerProject) {
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

function getBundledPrecachedAssets(project: PolymerProject) {
  let precachedAssets = new Set<string>(project.analyzer.allFragments);
  precachedAssets.add(project.entrypoint);

  return Array.from(precachedAssets).concat(project.bundler.sharedBundleUrl);
}

/**
 * Returns a service worker transform stream. This stream will add a service
 * worker to the build stream, based on the options passed and build analysis
 * performed eariler in the stream.
 *
 * Note that this stream closely resembles a pass-through stream. It does not
 * modify the files that pass through it. It only ever adds 1 file.
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
      swPrecache.generate(swConfig, (err?: Error, fileContents?: string) => {
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
 * Returns a service worker transform stream. This stream will add a service
 * worker to the build stream, based on the options passed and build analysis
 * performed eariler in the stream.
 *
 * Note that this stream closely resembles a pass-through stream. It does not
 * modify the files that pass through it. It only ever adds 1 file.
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


