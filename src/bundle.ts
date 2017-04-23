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

import File = require('vinyl');
import * as parse5 from 'parse5';
import {Bundler, Options as BundlerOptions} from 'polymer-bundler';
import {BundleManifest, BundleStrategy, generateShellMergeStrategy, BundleUrlMapper} from 'polymer-bundler/lib/bundle-manifest';
import {ProjectConfig} from 'polymer-project-config';
import {Transform} from 'stream';

import {BuildAnalyzer} from './analyzer';
import {FileMapUrlLoader} from './file-map-url-loader';
import {pathFromUrl, urlFromPath} from './path-transformers';

export type Options =
    BundlerOptions & {strategy?: BundleStrategy, urlMapper?: BundleUrlMapper};

export class BuildBundler extends Transform {
  config: ProjectConfig;

  private _buildAnalyzer: BuildAnalyzer;
  private _bundler: Bundler;

  private _strategy?: BundleStrategy;
  private _urlMapper?: BundleUrlMapper;

  // A map of urls to file objects.  As the transform stream handleds files
  // coming into the stream, it collects all files here.  After bundlling,
  // we remove files from this set that have been inlined and replace
  // entrypoint/fragment files with bundled versions.
  files = new Map<string, File>();

  constructor(
      config: ProjectConfig,
      buildAnalyzer: BuildAnalyzer,
      options: Options = {}) {
    super({objectMode: true});

    this.config = config;

    this._buildAnalyzer = buildAnalyzer;

    let {analyzer,
         excludes,
         inlineCss,
         inlineScripts,
         rewriteUrlsInTemplates,
         sourcemaps,
         stripComments,
         strategy,
         urlMapper} = options;

    const urlLoader = new FileMapUrlLoader(
        this.config.root, this.files, analyzer || buildAnalyzer.analyzer);

    const forkedAnalyzer = analyzer ? analyzer._fork({urlLoader}) :
                                      buildAnalyzer.analyzer._fork({urlLoader});

    inlineCss = typeof inlineCss === 'undefined' || inlineCss;
    inlineScripts = typeof inlineScripts === 'undefined' || inlineScripts;

    this._bundler = new Bundler({
      analyzer: forkedAnalyzer,
      excludes,
      inlineCss,
      inlineScripts,
      rewriteUrlsInTemplates,
      sourcemaps,
      stripComments
    });
    this._strategy = strategy;
    this._urlMapper = urlMapper;
  }

  _transform(
      file: File,
      _encoding: string,
      callback: (error?: any, data?: File) => void): void {
    this._mapFile(file);
    callback(null, null);
  }

  _mapFile(file: File) {
    this.files.set(urlFromPath(this.config.root, file.path), file);
  }

  async _flush(done: (error?: any) => void) {
    const filesChanged: string[] = [];
    this._buildAnalyzer.files.forEach((originalFile, url) => {
      const downstreamFile = this.files.get(url);
      if (downstreamFile.contents.toString() !==
          originalFile.contents.toString()) {
        filesChanged.push(url);
      }
    });
    await this._bundler.analyzer.filesChanged(filesChanged);
    const bundles = await this._buildBundles();
    for (const filename of bundles.keys()) {
      const filepath = pathFromUrl(this.config.root, filename);
      const file = new File({
        path: filepath,
        contents: new Buffer(bundles.get(filename)),
      });
      this._mapFile(file);
    }
    this.files.forEach((file) => this.push(file));
    // end the stream
    done();
  }

  async _buildBundles(): Promise<Map<string, string>> {
    let strategy = this._strategy;
    if (!strategy && this.config.shell) {
      strategy = generateShellMergeStrategy(
          urlFromPath(this.config.root, this.config.shell));
    }
    const bundleEntrypoints = Array.from(this.config.allFragments);
    const manifest = await this._bundler.generateManifest(
        bundleEntrypoints.map((f) => urlFromPath(this.config.root, f)),
        strategy,
        this._urlMapper);
    const docCollection = await this._bundler.bundle(manifest);

    // Remove the bundled files from the file map so they are not emitted later.
    this._unmapBundledFiles(manifest);

    const contentsMap = new Map();
    for (const bundleName of docCollection.keys()) {
      contentsMap.set(
          bundleName, parse5.serialize(docCollection.get(bundleName).ast));
    }
    return contentsMap;
  }

  _unmapBundledFiles(manifest: BundleManifest) {
    for (const bundle of manifest.bundles.values()) {
      for (const filename of bundle.files) {
        this.files.delete(filename);
      }
    }
  }
}
