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
import {Bundler} from 'polymer-bundler';
import {BundleStrategy, generateShellMergeStrategy} from 'polymer-bundler/lib/bundle-manifest';

import {pathFromUrl, urlFromPath} from './path-transformers';
import {BuildAnalyzer} from './analyzer';
import * as parse5 from 'parse5';


export class BuildBundler extends Transform {
  config: ProjectConfig;

  sharedBundleUrl: string;

  analyzer: BuildAnalyzer;
  bundler: Bundler;
  sharedFile: File;

  constructor(config: ProjectConfig, analyzer: BuildAnalyzer) {
    super({objectMode: true});

    this.config = config;
    this.analyzer = analyzer;
    this.sharedBundleUrl = 'shared-bundle.html';
    this.bundler = new Bundler({
      analyzer: analyzer.analyzer,
      inlineCss: true,
      inlineScripts: true,
    });
  }

  _transform(
      file: File,
      _encoding: string,
      callback: (error?: any, data?: File) => void): void {
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
