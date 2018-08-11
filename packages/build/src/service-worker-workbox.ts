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

import * as assert from 'assert';
import {writeFile} from 'fs';
import * as path from 'path';
import * as logging from 'plylog';
import {generateSWString, getModuleUrl, WorkboxConfig } from 'workbox-build';

import {DepsIndex} from './analyzer';
import {LocalFsPath, posixifyPath} from './path-transformers';
import {PolymerProject} from './polymer-project';

const logger = logging.getLogger('polymer-build.service-worker');

export interface AddWorkboxServiceWorkerOptions {
  project: PolymerProject;
  buildRoot: LocalFsPath;
  bundled?: boolean;
  path?: LocalFsPath;
  workboxConfig?: WorkboxConfig|null;
  basePath?: LocalFsPath;
}

/**
 * Returns an array of file paths for the service worker to precache, based on
 * the information provided in the DepsIndex object.
 */
function getPrecachedAssets(
    depsIndex: DepsIndex, project: PolymerProject): string[] {
  const precachedAssets = new Set<string>(project.config.allFragments);
  precachedAssets.add(project.config.entrypoint);
  for (const depImports of depsIndex.fragmentToFullDeps.values()) {
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

// Matches URLs like "/foo.png/bar" but not "/foo/bar.png".
export const hasNoFileExtension = /\/[^\/\.]*(\?|$)/;

/**
 * Returns a promise that resolves with a generated service worker
 * configuration.
 */
export async function generateServiceWorkerConfig(
    options: AddWorkboxServiceWorkerOptions): Promise<WorkboxConfig> {
  assert(!!options, '`project` & `buildRoot` options are required');
  assert(!!options.project, '`project` option is required');
  assert(!!options.buildRoot, '`buildRoot` option is required');

  options = {...options};
  const project = options.project;
  const buildRoot = options.buildRoot;
  const workboxConfig: WorkboxConfig = {
    ...options.workboxConfig,
    globDirectory: buildRoot,
    navigateFallback: path.relative(project.config.root, project.config.entrypoint),
  };

  const depsIndex = await project.analyzer.analyzeDependencies;
  let staticFileGlobs = Array.from(workboxConfig.globPatterns || []);
  const precachedAssets = (options.bundled) ?
      getBundledPrecachedAssets(project) :
      getPrecachedAssets(depsIndex, project);

  if (workboxConfig.globPatterns === undefined) {
    staticFileGlobs = staticFileGlobs.concat(precachedAssets);
    staticFileGlobs = staticFileGlobs.map((filePath: string) => {
      if (filePath.startsWith(project.config.root)) {
        filePath = filePath.substring(project.config.root.length);
      }
      return removeLeadingSlash(filePath);
    });
  }

  // Add the workbox cdn scripts
  workboxConfig.importScripts = workboxConfig.importScripts || [];
  workboxConfig.importScripts.unshift(getModuleUrl('workbox-sw'));

  if (workboxConfig.navigateFallbackWhitelist === undefined) {
    // Don't fall back to the entrypoint if the URL looks like a static file.
    // We want those to 404 instead, since they are probably missing assets,
    // not application routes. Note it's important that this matches the
    // behavior of prpl-server.
    workboxConfig.navigateFallbackWhitelist = [hasNoFileExtension];
  }

  if (options.basePath) {
    workboxConfig.modifyUrlPrefix = {
      ...workboxConfig.modifyUrlPrefix,
      '': addTrailingSlash(posixifyPath(options.basePath)),
    };
  }

  // static files will be pre-cached
  workboxConfig.globPatterns = staticFileGlobs;
  return workboxConfig;
}

/**
 * Returns a promise that resolves with a generated service worker (the file
 * contents), based off of the options provided.
 */
export async function generateWorkboxServiceWorker(options: AddWorkboxServiceWorkerOptions):
    Promise<Buffer> {
  const workboxConfig = await generateServiceWorkerConfig(options);
  return await <Promise<Buffer>>(new Promise((resolve) => {
    logger.debug(`writing service worker...`, workboxConfig);
    generateSWString(workboxConfig).then(({ swString, warnings }) => {
      resolve(new Buffer(swString));
      warnings.forEach(warning => console.warn(warning));
    });
  }));
}

/**
 * Returns a promise that resolves when a service worker has been generated
 * and written to the build directory. This uses generateWorkboxServiceWorker() to
 * generate a service worker, which it then writes to the file system based on
 * the buildRoot & path (if provided) options.
 */
export async function addWorkboxServiceWorker(options: AddWorkboxServiceWorkerOptions):
    Promise<void> {
  return generateWorkboxServiceWorker(options).then((fileContents: Buffer) => {
    return new Promise<void>((resolve, reject) => {
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

function removeLeadingSlash(s: string): string {
  return (s.startsWith('/') || s.startsWith('\\')) ? s.substring(1) : s;
}

function addTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}
