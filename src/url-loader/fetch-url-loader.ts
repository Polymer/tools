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

import {resolve as resolveUrl} from 'url';
import {UrlLoader} from './url-loader';

declare const window: any;

/**
 * Resolves requests via the the DOM fetch API.
 */
export class FetchUrlLoader implements UrlLoader {
  baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  _resolve(url: string) {
    return this.baseUrl ? resolveUrl(this.baseUrl, url) : url;
  }

  canLoad(_: string): boolean {
    return true;
  }

  load(url: string): Promise<string> {
    return window.fetch(this._resolve(url)).then((response: any) => {
      if (response.ok) {
        return response.text();
      } else {
        return response.text().then((content: string) => {
          throw new Error(`Response not ok: ${content}`);
        });
      }
    });
  }
}
