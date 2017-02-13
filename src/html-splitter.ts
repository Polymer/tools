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

/**
 * HTMLSplitter represents the shared state of files as they are passed through
 * a splitting stream and then a rejoining stream. Creating a new instance of
 * HTMLSplitter and adding its streams to the build pipeline is the
 * supported user interface for splitting out and rejoining inlined CSS & JS in
 * the build process.
 */
export class HtmlSplitter {
  private _splitFiles: Map<string, SplitFile> = new Map();
  private _parts: Map<string, SplitFile> = new Map();

  /**
   * Returns a new `Transform` stream that splits inline script and styles into
   * new, separate files that are passed out of the stream.
   */
  split(): Transform {
    return new HtmlSplitTransform(this);
  }

  /**
   * Returns a new `Transform` stream that rejoins inline scripts and styles
   * that were originally split from this `HTMLSplitter`'s `split()` back into
   * their parent HTML files.
   */
  rejoin(): Transform {
    return new HtmlRejoinTransform(this);
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
 * Splits HTML files, extracting scripts and styles into separate File objects.
 */
class HtmlSplitTransform extends Transform {
  static isInlineScript =
      pred.AND(pred.hasTagName('script'), pred.NOT(pred.hasAttr('src')));

  _state: HtmlSplitter;

  constructor(splitter: HtmlSplitter) {
    super({objectMode: true});
    this._state = splitter;
  }

  _transform(file: File, _encoding: string, callback: FileCB): void {
    const filePath = osPath.normalize(file.path);
    if (file.contents && filePath.endsWith('.html')) {
      try {
        const contents = file.contents.toString();
        const doc = parse5.parse(contents);
        const scriptTags =
            dom5.queryAll(doc, HtmlSplitTransform.isInlineScript);
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
          this._state.addSplitPath(filePath, childPath);
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
 * Joins HTML files originally split by `Splitter`, based on the relationships
 * stored in its HTMLSplitter state.
 */
class HtmlRejoinTransform extends Transform {
  static isExternalScript =
      pred.AND(pred.hasTagName('script'), pred.hasAttr('src'));

  _state: HtmlSplitter;

  constructor(splitter: HtmlSplitter) {
    super({objectMode: true});
    this._state = splitter;
  }

  _transform(file: File, _encoding: string, callback: FileCB): void {
    const filePath = osPath.normalize(file.path);
    if (this._state.isSplitFile(filePath)) {
      // this is a parent file
      const splitFile = this._state.getSplitFile(filePath);
      splitFile.vinylFile = file;
      if (splitFile.isComplete) {
        callback(null, this._rejoin(splitFile));
      } else {
        splitFile.vinylFile = file;
        callback();
      }
    } else {
      const parentFile = this._state.getParentFile(filePath);
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
    const scriptTags = dom5.queryAll(doc, HtmlRejoinTransform.isExternalScript);

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
