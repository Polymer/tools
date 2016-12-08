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

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import * as path from 'path';
import {posix as posixPath} from 'path';
import {Transform} from 'stream';
import File = require('vinyl');
import * as logging from 'plylog';
import {ProjectConfig} from 'polymer-project-config';

import {urlFromPath} from './path-transformers';
import {BuildAnalyzer} from './analyzer';


// non-ES module
const Vulcanize = require('vulcanize');
const logger = logging.getLogger('cli.build.bundle');

// TODO(fks) 11-11-2016: Rename Bundler to BuildBundler
export class Bundler extends Transform {
  config: ProjectConfig;

  sharedBundleUrl: string;

  analyzer: BuildAnalyzer;
  sharedFile: File;

  constructor(config: ProjectConfig, analyzer: BuildAnalyzer) {
    super({objectMode: true});

    this.config = config;
    this.analyzer = analyzer;
    this.sharedBundleUrl = 'shared-bundle.html';
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
      for (const fragment of this.config.allFragments) {
        const file = this.analyzer.getFile(fragment);
        console.assert(file != null);
        const contents = bundles.get(fragment);
        file.contents = new Buffer(contents);
        this.push(file);
      }
      const sharedBundle = bundles.get(this.sharedBundleUrl);
      if (sharedBundle) {
        const contents = bundles.get(this.sharedBundleUrl);
        this.sharedFile.contents = new Buffer(contents);
        this.push(this.sharedFile);
      }
      // end the stream
      done();
    });
  }

  async _buildBundles(): Promise<Map<string, string>> {
    const bundles = await this._getBundles();
    const sharedDepsBundle = (this.config.shell) ?
        urlFromPath(this.config.root, this.config.shell) :
        this.sharedBundleUrl;
    const sharedDeps = bundles.get(sharedDepsBundle) || [];
    const promises: Promise<{url: string, contents: string}>[] = [];

    if (this.config.shell) {
      const shellFile = this.analyzer.getFile(this.config.shell);
      console.assert(shellFile != null);
      const newShellContent = this._addSharedImportsToShell(bundles);
      shellFile.contents = new Buffer(newShellContent);
    }

    for (const fragmentPath of this.config.allFragments) {
      const fragmentUrl = urlFromPath(this.config.root, fragmentPath);
      const addedImports = (this.config.isShell(fragmentPath)) ? [] : [
        posixPath.relative(posixPath.dirname(fragmentUrl), sharedDepsBundle)
      ];
      const excludes = (this.config.isShell(fragmentPath)) ?
          [] :
          sharedDeps.concat(sharedDepsBundle);

      promises.push(new Promise((resolve, reject) => {
        const vulcanize = new Vulcanize({
          fsResolver: this.analyzer.loader,
          addedImports: addedImports,
          stripExcludes: excludes,
          inlineScripts: true,
          inlineCss: true,
          inputUrl: fragmentPath,
        });
        vulcanize.process(null, (err: any, doc: string) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              url: fragmentPath,
              contents: doc,
            });
          }
        });
      }));
    }
    // vulcanize the shared bundle
    if (!this.config.shell && sharedDeps && sharedDeps.length !== 0) {
      logger.info(`generating shared bundle...`);
      promises.push(this._generateSharedBundle(sharedDeps));
    }
    const vulcanizedBundles = await Promise.all(promises);
    const contentsMap = new Map();
    for (const bundle of vulcanizedBundles) {
      contentsMap.set(bundle.url, bundle.contents);
    }
    return contentsMap;
  }

  _addSharedImportsToShell(bundles: Map<string, string[]>): string {
    console.assert(this.config.shell != null);
    const shellUrl = urlFromPath(this.config.root, this.config.shell);
    const shellUrlDir = posixPath.dirname(shellUrl);
    const shellDeps =
        bundles.get(shellUrl).map((d) => posixPath.relative(shellUrlDir, d));
    logger.debug('found shell dependencies', {
      shellUrl: shellUrl,
      shellUrlDir: shellUrlDir,
      shellDeps: shellDeps,
    });

    const file = this.analyzer.getFile(this.config.shell);
    console.assert(file != null);
    const contents = file.contents.toString();
    const doc = parse5.parse(contents);
    const imports = dom5.queryAll(
        doc,
        dom5.predicates.AND(
            dom5.predicates.hasTagName('link'),
            dom5.predicates.hasAttrValue('rel', 'import')));
    logger.debug('found html import elements', {
      imports: imports.map((el) => dom5.getAttribute(el, 'href')),
    });

    // Remove all imports that are in the shared deps list so that we prefer
    // the ordering or shared deps. Any imports left should be independent of
    // ordering of shared deps.
    const shellDepsSet = new Set(shellDeps);
    for (const _import of imports) {
      const importHref = dom5.getAttribute(_import, 'href');
      if (shellDepsSet.has(importHref)) {
        logger.debug(`removing duplicate import element "${importHref}"...`);
        dom5.remove(_import);
      }
    }

    // Append all shared imports to the end of <head>
    const head = dom5.query(doc, dom5.predicates.hasTagName('head'));
    for (const dep of shellDeps) {
      const newImport = dom5.constructors.element('link');
      dom5.setAttribute(newImport, 'rel', 'import');
      dom5.setAttribute(newImport, 'href', dep);
      dom5.append(head, newImport);
    }
    const newContents = parse5.serialize(doc);
    return newContents;
  }

  _generateSharedBundle(sharedDeps: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const contents =
          sharedDeps.map((d) => `<link rel="import" href="${d}">`).join('\n');
      const sharedBundlePath =
          path.resolve(this.config.root, this.sharedBundleUrl);

      this.sharedFile = new File({
        cwd: this.config.root,
        base: this.config.root,
        path: sharedBundlePath,
        contents: new Buffer(contents),
      });

      // make the shared bundle visible to vulcanize
      this.analyzer.addFile(this.sharedFile);

      const vulcanize = new Vulcanize({
        fsResolver: this.analyzer.loader,
        inlineScripts: true,
        inlineCss: true,
        inputUrl: sharedBundlePath,
      });
      vulcanize.process(null, (err: any, doc: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            url: this.sharedBundleUrl,
            contents: doc,
          });
        }
      });
    });
  }

  _getBundles() {
    return this.analyzer.analyzeDependencies.then((indexes) => {
      const depsToEntrypoints = indexes.depsToFragments;
      const fragmentToDeps = indexes.fragmentToDeps;
      const bundles = new Map<string, string[]>();

      const addImport = (from: string, to: string) => {
        let imports: string[];
        if (!bundles.has(from)) {
          imports = [];
          bundles.set(from, imports);
        } else {
          imports = bundles.get(from);
        }
        if (!imports.includes(to)) {
          imports.push(to);
        }
      };

      // We want to collect dependencies that appear in > 1 entrypoint, but
      // we need to collect them in document order, so rather than iterate
      // directly through each dependency in depsToEntrypoints, we iterate
      // through fragments in fragmentToDeps, which has dependencies in
      // order for each fragment. Then we iterate through dependencies for
      // each fragment and look up how many fragments depend on it.
      // This assumes an ordering between fragments, since they could have
      // conflicting orders between their top level imports. The shell should
      // always come first.
      for (const fragment of fragmentToDeps.keys()) {
        const fragmentUrl = urlFromPath(this.config.root, fragment);
        const dependencies = fragmentToDeps.get(fragment);
        for (const dep of dependencies) {
          const fragmentCount = depsToEntrypoints.get(dep).length;
          if (fragmentCount > 1) {
            if (this.config.shell) {
              addImport(urlFromPath(this.config.root, this.config.shell), dep);
            } else {
              addImport(this.sharedBundleUrl, dep);
              addImport(fragmentUrl, this.sharedBundleUrl);
            }
          } else {
            addImport(fragmentUrl, dep);
          }
        }
      }
      return bundles;
    });
  }
}
