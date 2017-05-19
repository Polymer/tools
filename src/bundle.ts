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
import {Bundler, Options, BundleManifest, generateShellMergeStrategy} from 'polymer-bundler';
import {ProjectConfig} from 'polymer-project-config';

import {BuildAnalyzer} from './analyzer';
import {FileMapUrlLoader} from './file-map-url-loader';
import {pathFromUrl, urlFromPath} from './path-transformers';
import {AsyncTransformStream} from './streams';

export {Options} from 'polymer-bundler';

export class BuildBundler extends AsyncTransformStream<File, File> {
  config: ProjectConfig;

  private _buildAnalyzer: BuildAnalyzer;
  private _bundler: Bundler;

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

    const {
      analyzer,
      excludes,
      inlineCss,
      inlineScripts,
      rewriteUrlsInTemplates,
      sourcemaps,
      stripComments,
      urlMapper
    } = options;
    let {strategy} = options;

    const urlLoader =
        new FileMapUrlLoader(this.files, analyzer || buildAnalyzer.analyzer);

    const forkedAnalyzer = analyzer ? analyzer._fork({urlLoader}) :
                                      buildAnalyzer.analyzer._fork({urlLoader});

    strategy = strategy ||
        this.config.shell &&
            generateShellMergeStrategy(
                urlFromPath(this.config.root, this.config.shell));

    this._bundler = new Bundler({
      analyzer: forkedAnalyzer,
      excludes,
      inlineCss,
      inlineScripts,
      rewriteUrlsInTemplates,
      sourcemaps,
      stripComments,
      strategy,
      urlMapper,
    });
  }

  protected async *
      _transformIter(files: AsyncIterable<File>): AsyncIterable<File> {
    for await (const file of files) {
      this._mapFile(file);
    }
    await this._buildBundles();
    for (const file of this.files.values()) {
      yield file;
    }
  }

  private async _buildBundles() {
    // Tell the analyzer about changed files so it can purge them from its cache
    // before using the analyzer for bundling.
    await this._bundler.analyzer.filesChanged(
        this._getFilesChangedSinceInitialAnalysis());

    const {documents, manifest} =
        await this._bundler.bundle(await this._generateBundleManifest());

    // Remove the bundled files from the file map so they are not emitted later.
    this._unmapBundledFiles(manifest);

    // Map the bundles into the file map.
    for (const [filename, document] of documents) {
      this._mapFile(new File({
        path: pathFromUrl(this.config.root, filename),
        contents: new Buffer(parse5.serialize(document.ast)),
      }));
    }
  }

  private async _generateBundleManifest(): Promise<BundleManifest> {
    const entrypoints = Array.from(this.config.allFragments)
                            .map((e) => urlFromPath(this.config.root, e));
    return this._bundler.generateManifest(entrypoints);
  }

  private _getFilesChangedSinceInitialAnalysis(): string[] {
    const filesChanged = [];
    for (const [url, originalFile] of this._buildAnalyzer.files) {
      const downstreamFile = this.files.get(url);
      if (downstreamFile.contents.toString() !==
          originalFile.contents.toString()) {
        filesChanged.push(url);
      }
    }
    return filesChanged;
  }

  private _mapFile(file: File) {
    this.files.set(urlFromPath(this.config.root, file.path), file);
  }

  /**
   * Removes all of the inlined files in a bundle manifest from the filemap.
   */
  private _unmapBundledFiles(manifest: BundleManifest) {
    for (const {inlinedHtmlImports,
                inlinedScripts,
                inlinedStyles} of manifest.bundles.values()) {
      for (const filename of
               [...inlinedHtmlImports, ...inlinedScripts, ...inlinedStyles]) {
        this.files.delete(filename);
      }
    }
  }
}
