/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import * as stream from 'stream';
import File = require('vinyl');

const baseMatcher = dom5.predicates.hasTagName('base');

/**
 * Find a `<base>` tag in the specified file and if found, update its `href`
 * with the given new value.
 */
export class BaseTagUpdater extends stream.Transform {
  constructor(private filePath: string, private newHref: string) {
    super({objectMode: true});
  }

  async _transform(
      file: File,
      _encoding: string,
      callback: (error?: any, file?: File) => void) {
    if (file.path !== this.filePath) {
      callback(null, file);
      return;
    }

    let contents: string;
    if (file.isBuffer()) {
      contents = file.contents.toString('utf-8');
    } else {
      const stream = file.contents as NodeJS.ReadableStream;
      stream.setEncoding('utf-8');
      contents = '';
      stream.on('data', (chunk: string) => contents += chunk);
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    }

    const parsed = parse5.parse(contents, {locationInfo: true});
    let base = dom5.query(parsed, baseMatcher);
    if (!base || dom5.getAttribute(base, 'href') === this.newHref) {
      callback(null, file);
      return;
    }

    dom5.setAttribute(base, 'href', this.newHref);
    dom5.removeFakeRootElements(parsed);
    const updatedFile = file.clone();
    updatedFile.contents = new Buffer(parse5.serialize(parsed), 'utf-8');
    callback(null, updatedFile);
  }
}
