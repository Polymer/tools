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

import {UrlLoader} from '../url-loader/url-loader';

export class UnexpectedResolutionError extends Error {
  resolvedValue: any;
  constructor(message: string, resolvedValue: any) {
    super(message);
    this.resolvedValue = resolvedValue;
  }
}

export async function invertPromise(promise: Promise<any>): Promise<any> {
  let value: any;
  try {
    value = await promise;
  } catch (e) {
    return e;
  }
  throw new UnexpectedResolutionError('Inverted Promise resolved', value);
}

export class TestUrlLoader implements UrlLoader {
  files: {[path: string]: string};

  constructor(files: {[path: string]: string}) {
    this.files = files;
  }

  canLoad(url: string) {
    return url in this.files;
  }

  async load(url: string): Promise<string> {
    if (this.canLoad(url)) {
      return this.files[url];
    }
    throw new Error(`cannot load file ${url}`);
  }
}
