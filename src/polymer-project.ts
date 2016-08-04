/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import * as osPath from 'path';
import * as logging from 'plylog';
import {Transform} from 'stream';
import File = require('vinyl');
import * as vfs from 'vinyl-fs';
import {StreamAnalyzer} from './analyzer';
import {Bundler} from './bundle';
import {FileCB} from './streams';
import {forkStream} from './fork-stream';

const logger = logging.getLogger('polymer-project');
const pred = dom5.predicates;

const extensionsForType: {[mimetype: string]: string} = {
  'text/ecmascript-6': 'js',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/x-typescript': 'ts',
  'text/x-typescript': 'ts',
};

export interface ProjectOptions {
  /**
   * Path to the root of the project on the filesystem.
   */
  root?: string;

  /**
   * The path relative to `root` of the entrypoint file that will be served for
   * app-shell style projects. Usually this is index.html.
   */
  entrypoint?: string;

  /**
   * The path relative to `root` of the app shell element.
   */
  shell?: string;

  /**
   * The path relative to `root` of the lazily loaded fragments. Usually the
   * pages of an app or other bundles of on-demand resources.
   */
  fragments?: string[];

  /**
   * List of glob patterns, relative to root, of this project's sources to read
   * from the file system.
   */
  sourceGlobs?: string[];

  /**
   * List of file paths, relative to the project directory, that should be included
   * as dependencies in the build target.
   */
  includeDependencies?: string[];
}

export const defaultSourceGlobs = [
  'src/**/*',
  // NOTE(fks) 06-29-2016: `polymer-cli serve` uses a bower.json file to display
  // information about the project. The file is included here by default.
  'bower.json',
];

function resolveGlob(fromPath: string, glob: string) {
  if (glob.startsWith('!')) {
    let includeGlob = glob.substring(1);
    return '!' + osPath.resolve(fromPath, includeGlob);
  } else {
    return osPath.resolve(fromPath, glob);
  }
}

export class PolymerProject {

  root: string;
  entrypoint: string;
  shell: string;
  fragments: string[];
  sourceGlobs: string[];
  includeDependencies: string[];

  private _splitFiles: Map<string, SplitFile> = new Map();
  private _parts: Map<string, SplitFile> = new Map();

  /**
   * A `Transform` stream that runs Hydrolysis analysis on the files. It
   * can be used to get information on dependencies and fragments for the
   * project once the source & dependency streams have been piped into it.
   */
  analyzer: StreamAnalyzer;

  /**
   * A `Transform` stream that modifies the files that pass through it based
   * on the dependency analysis done by the `analyzer` transform. It "bundles"
   * a project by injecting its dependencies into the application fragments
   * themselves, so that a minimum number of requests need to be made to load.
   *
   * (NOTE: The analyzer stream must be in the pipeline somewhere before this.)
   */
  bundler: Bundler;

  constructor(options?: ProjectOptions) {
    this.root = options.root || process.cwd();
    if (options.entrypoint) {
      this.entrypoint = osPath.resolve(this.root, options.entrypoint);
    }
    if (options.shell) {
      this.shell = osPath.resolve(this.root, options.shell);
    }
    this.fragments = (options.fragments || [])
        .map((f) => osPath.resolve(this.root, f));
    this.sourceGlobs = (options.sourceGlobs || defaultSourceGlobs)
        .map((glob) => resolveGlob(this.root, glob));
    this.includeDependencies = (options.includeDependencies || [])
        .map((path) => osPath.resolve(this.root, path));

    this.analyzer = new StreamAnalyzer(
      this.root,
      this.entrypoint,
      this.shell,
      this.fragments,
      this.allSourceGlobs);

    this.bundler = new Bundler(
      this.root,
      this.entrypoint,
      this.shell,
      this.fragments,
      this.analyzer);

    logger.debug(`root: ${this.root}`);
    logger.debug(`shell: ${this.shell}`);
    logger.debug(`entrypoint: ${this.entrypoint}`);
    logger.debug(`fragments: ${this.fragments}`);
    logger.debug(`sources: ${this.sourceGlobs}`);
    logger.debug(`includeDependencies: ${this.includeDependencies}`);
  }

  /**
   * An array of globs composed of `entrypoint`, `shell`, `fragments`,
   * and `sourceGlobs`.
   */
  get allSourceGlobs(): string[] {
    let globs: string[] = [];
    if (this.entrypoint) globs.push(this.entrypoint);
    if (this.shell) globs.push(this.shell);
    if (this.fragments && this.fragments.length) {
      globs = globs.concat(this.fragments);
    }
    if (this.sourceGlobs && this.sourceGlobs.length > 0) {
      globs = globs.concat(this.sourceGlobs);
    }
    logger.debug(`sourceGlobs: \n\t${globs.join('\n\t')}`);
    return globs;
  }

  // TODO(justinfagnani): add options, pass to vfs.src()
  /**
   * Returns a streams of this project's source files - files matched by the
   * globs returns from `getSourceGlobs`, and not matched by
   * `getDependencyGlobs` (which are inverted and appended to the source globs).
   */
  sources(): NodeJS.ReadableStream {
    return vfs.src(this.allSourceGlobs, {
      allowEmpty: true,
      cwdbase: true,
      nodir: true,
    });
  }

  dependencies(): NodeJS.ReadableStream {
    let dependenciesStream: NodeJS.ReadableStream = forkStream(
      this.analyzer.dependencies
    );

    // If we need to include additional dependencies, create a new vfs.src
    // stream and pipe our default dependencyStream through it to combine.
    if (this.includeDependencies.length > 0) {
      let includeStream = vfs.src(this.includeDependencies, {
         allowEmpty: true,
         cwdbase: true,
         nodir: true,
         passthrough: true,
      });
      dependenciesStream = dependenciesStream.pipe(includeStream);
    }

    return dependenciesStream;
  }

  /**
   * Returns a new `Transform` that splits inline script into separate files.
   * To use an HTML splitter on multiple streams, create a new instance for each
   * stream.
   */
  splitHtml(): Transform {
    return new HtmlSplitter(this);
  }

  /**
   * Returns a new `Transform` that rejoins previously inline scripts that were
   * split from an HTML by `splitHtml` into their parent HTML file.
   * To use an HTML rejoiner on multiple streams, create a new instance for each
   * stream.
   */
  rejoinHtml(): Transform {
    return new HtmlRejoiner(this);
  }

  isSplitFile(parentPath: string): boolean {
    return this._splitFiles.has(parentPath);
  }

  getSplitFile(parentPath: string): SplitFile {
    // TODO(justinfagnani): rewrite so that processing a parent file twice
    // throws to protect against bad configurations of multiple streams that
    // contain the same file multiple times.
    let splitFile = this._splitFiles.get(parentPath);
    if (!splitFile) {
      splitFile = new SplitFile(parentPath);
      this._splitFiles.set(parentPath, splitFile);
    }
    return splitFile;
  }

  addSplitPath(parentPath: string, childPath: string): void {
    let splitFile = this.getSplitFile(parentPath);
    splitFile.addPartPath(childPath);
    this._parts.set(childPath, splitFile);
  }

  getParentFile(childPath: string): SplitFile {
    return this._parts.get(childPath);
  }

}

/**
 * Represents a file that is split into multiple files.
 */
export class SplitFile {
  path: string;
  parts: Map<string, string> = new Map();
  outstandingPartCount = 0;
  vinylFile: File = null;

  constructor(path: string) {
    this.path = path;
  }

  addPartPath(path: string): void {
    this.parts.set(path, null);
    this.outstandingPartCount++;
  }

  setPartContent(path: string, content: string): void {
    console.assert(this.parts.get(path) === null);
    console.assert(this.outstandingPartCount > 0);
    this.parts.set(path, content);
    this.outstandingPartCount--;
  }

  get isComplete(): boolean {
    return this.outstandingPartCount === 0 && this.vinylFile != null;
  }
}

/**
 * Splits HTML files, extracting scripts and styles into separate `File`s.
 */
class HtmlSplitter extends Transform {

  static isInlineScript = pred.AND(
    pred.hasTagName('script'),
    pred.NOT(pred.hasAttr('src'))
  );

  _project: PolymerProject;

  constructor(project: PolymerProject) {
    super({objectMode: true});
    this._project = project;
  }

  _transform(file: File, encoding: string, callback: FileCB): void {
    let filePath = osPath.normalize(file.path);
    if (file.contents && filePath.endsWith('.html')) {
      try {
        let contents = file.contents.toString();
        let doc = dom5.parse(contents);
        let body = dom5.query(doc, pred.hasTagName('body'));
        let head = dom5.query(doc, pred.hasTagName('head'));
        let scriptTags = dom5.queryAll(doc, HtmlSplitter.isInlineScript);
        let styleTags = dom5.queryAll(doc, pred.hasTagName('style'));

        // let scripts = [];
        // let styles = [];

        for (let i = 0; i < scriptTags.length; i++) {
          let scriptTag = scriptTags[i];
          let source = dom5.getTextContent(scriptTag);
          let typeAtribute = dom5.getAttribute(scriptTag, 'type');
          let extension = typeAtribute && extensionsForType[typeAtribute] || 'js';
          let childFilename = `${osPath.basename(filePath)}_script_${i}.${extension}`;
          let childPath = osPath.join(osPath.dirname(filePath), childFilename);
          scriptTag.childNodes = [];
          dom5.setAttribute(scriptTag, 'src', childFilename);
          let scriptFile = new File({
            cwd: file.cwd,
            base: file.base,
            path: childPath,
            contents: new Buffer(source),
          });
          this._project.addSplitPath(filePath, childPath);
          this.push(scriptFile);
        }

        let splitContents = dom5.serialize(doc);
        let newFile = new File({
          cwd: file.cwd,
          base: file.base,
          path: filePath,
          contents: new Buffer(splitContents),
        });
        callback(null, newFile);
      } catch (e) {
        logger.error(e);
        callback(e, null);
      }
    } else {
      callback(null, file);
    }
  }
}


/**
 * Joins HTML files split by `Splitter`.
 */
class HtmlRejoiner extends Transform {

  static isExternalScript = pred.AND(
    pred.hasTagName('script'),
    pred.hasAttr('src')
  );

  _project: PolymerProject;

  constructor(project: PolymerProject) {
    super({objectMode: true});
    this._project = project;
  }

  _transform(file: File, encoding: string, callback: FileCB): void {
    let filePath = osPath.normalize(file.path);
    if (this._project.isSplitFile(filePath)) {
      // this is a parent file
      let splitFile = this._project.getSplitFile(filePath);
      splitFile.vinylFile = file;
      if (splitFile.isComplete) {
        callback(null, this._rejoin(splitFile));
      } else {
        splitFile.vinylFile = file;
        callback();
      }
    } else {
      let parentFile = this._project.getParentFile(filePath);
      if (parentFile) {
        // this is a child file
        parentFile.setPartContent(filePath, file.contents.toString());
        if (parentFile.isComplete) {
          callback(null, this._rejoin(parentFile));
        } else {
          callback();
        }
      } else {
        callback(null, file);
      }
    }
  }

  _rejoin(splitFile: SplitFile) {
    let file = splitFile.vinylFile;
    let filePath = osPath.normalize(file.path);
    let contents = file.contents.toString();
    let doc = dom5.parse(contents);
    let body = dom5.query(doc, pred.hasTagName('body'));
    let head = dom5.query(doc, pred.hasTagName('head'));
    let scriptTags = dom5.queryAll(doc, HtmlRejoiner.isExternalScript);
    let styleTags = dom5.queryAll(doc, pred.hasTagName('style'));

    for (let i = 0; i < scriptTags.length; i++) {
      let scriptTag = scriptTags[i];
      let srcAttribute = dom5.getAttribute(scriptTag, 'src');
      let scriptPath = osPath.join(osPath.dirname(splitFile.path), srcAttribute);
      if (splitFile.parts.has(scriptPath)) {
        let scriptSource = splitFile.parts.get(scriptPath);
        dom5.setTextContent(scriptTag, scriptSource);
        dom5.removeAttribute(scriptTag, 'src');
      }
    }

    let joinedContents = dom5.serialize(doc);

    return new File({
      cwd: file.cwd,
      base: file.base,
      path: filePath,
      contents: new Buffer(joinedContents),
    });

  }
}
