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
import * as osPath from 'path';
import * as logging from 'plylog';
import {Transform} from 'stream';
import File = require('vinyl');
import {src as vinylSrc} from 'vinyl-fs';
import {ProjectConfig, ProjectOptions} from 'polymer-project-config';

import {BuildAnalyzer} from './analyzer';
import {Bundler} from './bundle';
import {FileCB} from './streams';

const logger = logging.getLogger('polymer-project');
const pred = dom5.predicates;

const extensionsForType: {[mimetype: string]: string} = {
  'text/ecmascript-6': 'js',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/x-typescript': 'ts',
  'text/x-typescript': 'ts',
};

export class PolymerProject {
  config: ProjectConfig;

  private _splitFiles: Map<string, SplitFile> = new Map();
  private _parts: Map<string, SplitFile> = new Map();

  /**
   * A `Transform` stream that runs Hydrolysis analysis on the files. It
   * can be used to get information on dependencies and fragments for the
   * project once the source & dependency streams have been piped into it.
   */
  analyzer: BuildAnalyzer;

  /**
   * A `Transform` stream that modifies the files that pass through it based
   * on the dependency analysis done by the `analyzer` transform. It "bundles"
   * a project by injecting its dependencies into the application fragments
   * themselves, so that a minimum number of requests need to be made to load.
   *
   * (NOTE: The analyzer stream must be in the pipeline somewhere before this.)
   */
  bundler: Bundler;

  constructor(config: ProjectConfig|ProjectOptions|string) {
    if (config.constructor.name === 'ProjectConfig') {
      this.config = <ProjectConfig>config;
    } else if (typeof config === 'string') {
      this.config = ProjectConfig.loadConfigFromFile(config);
    } else {
      this.config = new ProjectConfig(config);
    }

    logger.debug(`config: ${this.config}`);

    this.analyzer = new BuildAnalyzer(this.config);
    this.bundler = new Bundler(this.config, this.analyzer);
  }

  /**
   * Returns the analyzer's stream of this project's source files - files
   * matched by the project's `config.sources` value.
   */
  sources(): NodeJS.ReadableStream {
    return this.analyzer.sources;
  }

  /**
   * Returns the analyzer's stream of this project's dependency files - files
   * loaded inside the analyzed project that are not considered source files.
   */
  dependencies(): NodeJS.ReadableStream {
    let dependenciesStream: NodeJS.ReadableStream = this.analyzer.dependencies;

    // If we need to include additional dependencies, create a new vinyl source
    // stream and pipe our default dependencyStream through it to combine.
    if (this.config.extraDependencies.length > 0) {
      const includeStream = vinylSrc(this.config.extraDependencies, {
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
    const splitFile = this.getSplitFile(parentPath);
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
  static isInlineScript =
      pred.AND(pred.hasTagName('script'), pred.NOT(pred.hasAttr('src')));

  _project: PolymerProject;

  constructor(project: PolymerProject) {
    super({objectMode: true});
    this._project = project;
  }

  _transform(file: File, _encoding: string, callback: FileCB): void {
    const filePath = osPath.normalize(file.path);
    if (file.contents && filePath.endsWith('.html')) {
      try {
        const contents = file.contents.toString();
        const doc = parse5.parse(contents);
        const scriptTags = dom5.queryAll(doc, HtmlSplitter.isInlineScript);
        for (let i = 0; i < scriptTags.length; i++) {
          const scriptTag = scriptTags[i];
          const source = dom5.getTextContent(scriptTag);
          const typeAtribute =
              dom5.getAttribute(scriptTag, 'type') || 'application/javascript';
          const extension = extensionsForType[typeAtribute];
          // If we don't recognize the script type attribute, don't split out.
          if (!extension) {
            continue;
          }

          const childFilename =
              `${osPath.basename(filePath)}_script_${i}.${extension}`;
          const childPath =
              osPath.join(osPath.dirname(filePath), childFilename);
          scriptTag.childNodes = [];
          dom5.setAttribute(scriptTag, 'src', childFilename);
          const scriptFile = new File({
            cwd: file.cwd,
            base: file.base,
            path: childPath,
            contents: new Buffer(source),
          });
          this._project.addSplitPath(filePath, childPath);
          this.push(scriptFile);
        }

        const splitContents = parse5.serialize(doc);
        const newFile = new File({
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
  static isExternalScript =
      pred.AND(pred.hasTagName('script'), pred.hasAttr('src'));

  _project: PolymerProject;

  constructor(project: PolymerProject) {
    super({objectMode: true});
    this._project = project;
  }

  _transform(file: File, _encoding: string, callback: FileCB): void {
    const filePath = osPath.normalize(file.path);
    if (this._project.isSplitFile(filePath)) {
      // this is a parent file
      const splitFile = this._project.getSplitFile(filePath);
      splitFile.vinylFile = file;
      if (splitFile.isComplete) {
        callback(null, this._rejoin(splitFile));
      } else {
        splitFile.vinylFile = file;
        callback();
      }
    } else {
      const parentFile = this._project.getParentFile(filePath);
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
    const file = splitFile.vinylFile;
    const filePath = osPath.normalize(file.path);
    const contents = file.contents.toString();
    const doc = parse5.parse(contents);
    const scriptTags = dom5.queryAll(doc, HtmlRejoiner.isExternalScript);

    for (let i = 0; i < scriptTags.length; i++) {
      const scriptTag = scriptTags[i];
      const srcAttribute = dom5.getAttribute(scriptTag, 'src');
      const scriptPath =
          osPath.join(osPath.dirname(splitFile.path), srcAttribute);
      if (splitFile.parts.has(scriptPath)) {
        const scriptSource = splitFile.parts.get(scriptPath);
        dom5.setTextContent(scriptTag, scriptSource);
        dom5.removeAttribute(scriptTag, 'src');
      }
    }

    const joinedContents = parse5.serialize(doc);

    return new File({
      cwd: file.cwd,
      base: file.base,
      path: filePath,
      contents: new Buffer(joinedContents),
    });
  }
}
