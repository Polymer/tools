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

import {Transform} from 'stream';
import File = require('vinyl');
import {ProjectConfig} from 'polymer-project-config';
import {Analyzer} from 'polymer-analyzer';
import {PackageUrlResolver} from 'polymer-analyzer/lib/url-loader/package-url-resolver';
import {UrlLoader} from 'polymer-analyzer/lib/url-loader/url-loader';
import {Bundler} from 'polymer-bundler';
import {BundleStrategy, generateShellMergeStrategy} from 'polymer-bundler/lib/bundle-manifest';
import {parseUrl} from 'polymer-analyzer/lib/utils';
import {pathFromUrl, urlFromPath} from './path-transformers';
import * as logging from 'plylog';
import {BuildAnalyzer} from './analyzer';
import * as parse5 from 'parse5';

const logger = logging.getLogger('cli.build.analyzer');

export class BuildBundler extends Transform {
  config: ProjectConfig;

  sharedBundleUrl: string;

  analyzer: BuildAnalyzer;
  bundler: Bundler;
  sharedFile: File;

  files = new Map<string, File>();

  constructor(config: ProjectConfig, analyzer: BuildAnalyzer) {
    super({objectMode: true});

    this.config = config;

    this.analyzer = analyzer;
    this.sharedBundleUrl = 'shared-bundle.html';
    this.bundler = new Bundler({
      analyzer: new Analyzer({
        urlResolver: new PackageUrlResolver(this.config.root),
        urlLoader: new StreamLoader(
            this.config,
            (url: string): boolean => this.analyzer.analyzer.canResolveUrl(url),
            (url: string): File => this.files.get(url))
      }),
      inlineCss: true,
      inlineScripts: true,
    });
  }

  _transform(
      file: File,
      _encoding: string,
      callback: (error?: any, data?: File) => void): void {
    this.files.set(file.path, file);
    // If this file is a fragment, hold on to the file so that it's fully
    // analyzed by the time down-stream transforms see it.
    if (this.config.isFragment(file.path)) {
      callback(null, null);
    } else {
      callback(null, file);
    }
  }

  _flush(done: (error?: any) => void) {
    this._buildBundles().then((bundles: Map<string, string>) => {
      for (const filename of bundles.keys()) {
        const filepath = pathFromUrl(this.config.root, filename);
        let file =
            this.analyzer.getFile(filepath) || new File({path: filepath});
        const contents = bundles.get(filename);
        file.contents = new Buffer(contents);
        this.push(file);
      }
      // end the stream
      done();
    });
  }

  async _buildBundles(): Promise<Map<string, string>> {
    let strategy: BundleStrategy;
    if (this.config.shell) {
      strategy = generateShellMergeStrategy(
          urlFromPath(this.config.root, this.config.shell));
    }
    const bundleEntrypoints = Array.from(this.config.allFragments);
    return this.bundler
        .bundle(
            bundleEntrypoints.map(f => urlFromPath(this.config.root, f)),
            strategy)
        .then((docCollection) => {
          const contentsMap = new Map();
          for (const bundleName of docCollection.keys()) {
            contentsMap.set(
                bundleName,
                parse5.serialize(docCollection.get(bundleName).ast));
          }
          return contentsMap;
        });
  }
}

export type ResolveFileCallback = (a: string) => void;
export type RejectFileCallback = (err: Error) => void;
export type DeferredFileCallbacks = {
  resolve: ResolveFileCallback; reject: RejectFileCallback;
};

class StreamLoader implements UrlLoader {
  config: ProjectConfig;
  canLoad: (url: string) => boolean;
  getFile: (url: string) => File;

  // Store files that have not yet entered the Analyzer stream here.
  // Later, when the file is seen, the DeferredFileCallback can be
  // called with the file contents to resolve its loading.
  deferredFiles = new Map<string, DeferredFileCallbacks>();

  constructor(
      config: ProjectConfig,
      canLoad: (url: string) => boolean,
      getFile: (url: string) => File) {
    this.config = config, this.canLoad = canLoad;
    this.getFile = getFile;
  }

  load(url: string): Promise<string> {
    logger.debug(`loading: ${url}`);

    if (!this.canLoad(url)) {
      return Promise.resolve(undefined);
    }

    const urlObject = parseUrl(url);
    const urlPath = decodeURIComponent(urlObject.pathname);
    const filePath = pathFromUrl(this.config.root, urlPath);
    const file = this.getFile(filePath);

    if (file) {
      return Promise.resolve(file.contents.toString());
    }

    return new Promise(
        (resolve: ResolveFileCallback, reject: RejectFileCallback) => {
          this.deferredFiles.set(filePath, {resolve, reject});
        });
  }
}
