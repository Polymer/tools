/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as fs from 'fs';
import {Analyzer, Deferred, Loader, Resolver, DocumentDescriptor}
  from 'hydrolysis';
import * as path from 'path';
import {PassThrough, Transform} from 'stream';
import File = require('vinyl');
import {parse as parseUrl} from 'url';
import * as logging from 'plylog';
import {Node, queryAll, predicates, getAttribute} from 'dom5';

import {FileCB, VinylReaderTransform} from './streams';
import {urlFromPath, pathFromUrl} from './path-transformers';
import {DocumentDeps, getDependenciesFromDocument, isDependencyExternal}
  from './get-dependencies-from-document';

const minimatchAll = require('minimatch-all');
const logger = logging.getLogger('cli.build.analyzer');

export interface DepsIndex {
  // An index of dependency -> fragments that depend on it
  depsToFragments: Map<string, string[]>;
  // TODO(garlicnation): Remove this map.
  // An index of fragments -> html dependencies
  fragmentToDeps: Map<string, string[]>;
  // A map from frament urls to html, js, and css dependencies.
  fragmentToFullDeps: Map<string, DocumentDeps>;
}

export class StreamAnalyzer extends Transform {

  root: string;
  entrypoint: string;
  shell: string;
  fragments: string[];
  allFragments: string[];
  sourceGlobs: string[];

  resolver: StreamResolver;
  loader: Loader;
  analyzer: Analyzer;

  private _dependenciesStream = new PassThrough({ objectMode: true });
  private _dependenciesProcessingStream = new VinylReaderTransform();

  files = new Map<string, File>();
  allFragmentsToAnalyze: Set<string>;
  foundDependencies = new Set<string>();

  analyzeDependencies: Promise<DepsIndex>;
  _dependencyAnalysis: DepsIndex = {
    depsToFragments: new Map(),
    fragmentToDeps: new Map(),
    fragmentToFullDeps: new Map()
  };
  _resolveDependencyAnalysis: (index: DepsIndex) => void;

  constructor(root: string, entrypoint: string, shell: string,
      fragments: string[], sourceGlobs: string[]) {
    super({objectMode: true});

    this.root = root;
    this.entrypoint = entrypoint;
    this.shell = shell;
    this.fragments = fragments;
    this.sourceGlobs = sourceGlobs;
    this.allFragments = [];

    // It's important that shell is first for document-ordering of imports
    if (shell) {
      this.allFragments.push(shell);
    }
    if (entrypoint && !shell && fragments.length === 0) {
      this.allFragments.push(entrypoint);
    }
    if (fragments) {
      this.allFragments = this.allFragments.concat(fragments);
    }

    this.resolver = new StreamResolver(this);
    this.loader = new Loader();
    this.loader.addResolver(this.resolver);
    this.analyzer = new Analyzer(false, this.loader);

    // Connect the dependencies stream that the analyzer pushes into to the
    // processing stream which loads each file and attaches the file contents.
    this._dependenciesStream.pipe(this._dependenciesProcessingStream);

    this.allFragmentsToAnalyze = new Set(this.allFragments);
    this.analyzeDependencies = new Promise((resolve, reject) => {
      this._resolveDependencyAnalysis = resolve;
    });
  }

  /**
   * The source dependency stream that Analyzer pushes discovered dependencies
   * into is connected to the post-processing stream. We want consumers to only
   * use the post-processed data so that all file objects have contents
   * loaded by default. This also makes Analyzer easier for us to test.
   */
  get dependencies(): Transform {
    return this._dependenciesProcessingStream;
  }

  _transform(file: File, encoding: string, callback: FileCB): void {
    let filePath = file.path;
    this.addFile(file);

    // If our resolver is waiting for this file, resolve its deferred loader
    if (this.resolver.hasDeferredFile(filePath)) {
      this.resolver.resolveDeferredFile(filePath, file);
    }

    // Propagate the file so that the stream can continue
    callback(null, file);

    // If the file is a fragment, begin analysis on its dependencies
    if (this.isFragment(file)) {
      this._getDependencies(urlFromPath(this.root, filePath))
        .then((deps: DocumentDeps) => {
          // Add all found dependencies to our index
          this._addDependencies(filePath, deps);
          this.allFragmentsToAnalyze.delete(filePath);
          // If there are no more fragments to analyze, close the dependency stream
          if (this.allFragmentsToAnalyze.size === 0) {
            this._dependenciesStream.end();
          }
        });
    }
  }

  _flush(done: (error?: any) => void) {
    // If stream finished with files that still needed to be loaded, error out
    if (this.resolver.hasDeferredFiles()) {
      for (let fileUrl of this.resolver.deferredFiles.keys()) {
        logger.error(`${fileUrl} never loaded`);
      }
      done(new Error(`${this.resolver.deferredFiles.size} deferred files were never loaded`));
      return;
    }
    // Resolve our dependency analysis promise now that we have seen all files
    this._resolveDependencyAnalysis(this._dependencyAnalysis);
    done();
  }

  getFile(filepath: string): File {
    let url = urlFromPath(this.root, filepath);
    return this.getFileByUrl(url);
  }

  getFileByUrl(url: string): File {
    if (url.startsWith('/')) {
      url = url.substring(1);
    }
    return this.files.get(url);
  }

  isFragment(file: File): boolean {
    return this.allFragments.indexOf(file.path) !== -1;
  }

  /**
   * A side-channel to add files to the resolver that did not come throgh the
   * stream transformation. This is for generated files, like
   * shared-bundle.html. This should probably be refactored so that the files
   * can be injected into the stream.
   */
  addFile(file: File): void {
    logger.debug(`addFile: ${file.path}`);
    // Badly-behaved upstream transformers (looking at you gulp-html-minifier)
    // may use posix path separators on Windows.
    let filepath = path.normalize(file.path);
    // Store only root-relative paths, in URL/posix format
    this.files.set(urlFromPath(this.root, filepath), file);
  }

  /**
   * Attempts to retreive document-order transitive dependencies for `url`.
   */
  _getDependencies(url: string): Promise<DocumentDeps> {
    let dir = path.posix.dirname(url);

    return this.analyzer.metadataTree(url)
        .then((tree) => getDependenciesFromDocument(tree, dir));
  }

  _addDependencies(filePath: string, deps: DocumentDeps) {
    // Make sure function is being called properly
    if (!this.allFragmentsToAnalyze.has(filePath)) {
      throw new Error(`Dependency analysis incorrectly called for ${filePath}`);
    }

    // Add dependencies to _dependencyAnalysis object, and push them through
    // the dependency stream.
    this._dependencyAnalysis.fragmentToFullDeps.set(filePath, deps);
    this._dependencyAnalysis.fragmentToDeps.set(filePath, deps.imports);
    deps.scripts.forEach((url) => this.pushDependency(url));
    deps.styles.forEach((url) => this.pushDependency(url));
    deps.imports.forEach((url) => {
      this.pushDependency(url);

      let entrypointList: string[] = this._dependencyAnalysis.depsToFragments.get(url);
      if (entrypointList) {
        entrypointList.push(filePath);
      } else {
        this._dependencyAnalysis.depsToFragments.set(url, [filePath]);
      }
    });
  }

  /**
   * Process the given dependency before pushing it through the stream.
   * Each dependency is only pushed through once to avoid duplicates.
   */
  pushDependency(dependencyUrl: string) {
    if (this.getFileByUrl(dependencyUrl)) {
      logger.debug('dependency has already been pushed, ignoring...', {dep: dependencyUrl});
      return;
    }

    let dependencyFilePath = pathFromUrl(this.root, dependencyUrl);
    if (minimatchAll(dependencyFilePath, this.sourceGlobs)) {
      logger.debug('dependency is a source file, ignoring...', {dep: dependencyUrl});
      return;
    }

    logger.debug('new dependency found, pushing into dependency stream...', dependencyFilePath);
    this._dependenciesStream.push(dependencyFilePath);
  }
}

export class StreamResolver implements Resolver {

  root: string;
  analyzer: StreamAnalyzer;
  deferredFiles = new Map<string, Deferred<string>>();

  constructor(analyzer: StreamAnalyzer) {
    this.analyzer = analyzer;
    this.root = this.analyzer.root;
  }

  hasDeferredFile(filePath: string): boolean {
    return this.deferredFiles.has(filePath);
  }

  hasDeferredFiles(): boolean {
    return this.deferredFiles.size > 0;
  }

  resolveDeferredFile(filePath: string, file: File): void {
    let deferred = this.deferredFiles.get(filePath);
    deferred.resolve(file.contents.toString());
    this.deferredFiles.delete(filePath);
  }

  accept(url: string, deferred: Deferred<string>): boolean {
    logger.debug(`accept: ${url}`);
    let urlObject = parseUrl(url);

    // Resolve external files as empty strings. We filter these out later
    // in the analysis process to make sure they aren't included in the build.
    if (isDependencyExternal(url)) {
      deferred.resolve('');
      return true;
    }

    let urlPath = decodeURIComponent(urlObject.pathname);
    let filePath = pathFromUrl(this.root, urlPath);
    let file = this.analyzer.getFile(filePath);

    if (file) {
      deferred.resolve(file.contents.toString());
    } else {
      this.deferredFiles.set(filePath, deferred);
      this.analyzer.pushDependency(urlPath);
    }

    return true;
  }
}