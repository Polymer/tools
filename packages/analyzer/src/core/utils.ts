/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as path from 'path';
import {parse as parseUrl_, resolve as resolveUrl_, Url} from 'url';
import {ResolvedUrl} from '../model/url';

const unspecifiedProtocol = '-';
export function parseUrl(
    url: string, defaultProtocol: string = unspecifiedProtocol): Url {
  const urlObject = parseUrl_(ensureProtocol(url, defaultProtocol));
  if (urlObject.protocol &&
      urlObject.protocol.slice(0, -1) === unspecifiedProtocol) {
    urlObject.protocol = undefined;
    urlObject.href =
        urlObject.href && urlObject.href.slice(unspecifiedProtocol.length + 1);
  }
  return urlObject;
}

const contentTypeToFileExtension: ReadonlyMap<string, string> = new Map([
  ['text/html', 'html'],
  ['application/javascript', 'js'],
  ['text/css', 'css'],
  ['application/json', 'json']
]);

export function getExtension(
    url: ResolvedUrl,
    userProvidedUrlToContentType: undefined|
    ((url: ResolvedUrl) => undefined | string)): string {
  if (userProvidedUrlToContentType !== undefined) {
    const contentType = userProvidedUrlToContentType(url);
    if (contentType !== undefined) {
      const fileExtension = contentTypeToFileExtension.get(contentType);
      if (fileExtension !== undefined) {
        return fileExtension;
      }
    }
  }
  return path.extname(url).substring(1);
}

export function ensureProtocol(url: string, defaultProtocol: string): string {
  return url.startsWith('//') ? `${defaultProtocol}:${url}` : url;
}

export function resolveUrl(
    baseUrl: string, targetUrl: string, defaultProtocol: string): string {
  const baseProtocol = (parseUrl_(baseUrl).protocol || '').slice(0, -1);
  const protocol = baseProtocol !== 'file' && baseProtocol || defaultProtocol;
  return resolveUrl_(
      ensureProtocol(baseUrl, protocol), ensureProtocol(targetUrl, protocol));
}

export function trimLeft(str: string, char: string): string {
  let leftEdge = 0;
  while (str[leftEdge] === char) {
    leftEdge++;
  }
  return str.substring(leftEdge);
}

export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (result: T) => void;
  reject!: (error: {}|undefined|null) => void;
  resolved = false;
  rejected = false;
  error: {}|undefined|null;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (result: T) => {
        if (this.resolved) {
          throw new Error('Already resolved');
        }
        if (this.rejected) {
          throw new Error('Already rejected');
        }
        this.resolved = true;
        resolve(result);
      };
      this.reject = (error: Error) => {
        if (this.resolved) {
          throw new Error('Already resolved');
        }
        if (this.rejected) {
          throw new Error('Already rejected');
        }
        this.rejected = true;
        this.error = error;
        reject(error);
      };
    });
  }

  toNodeCallback() {
    return (error: {}|null|undefined, value: T) => {
      if (error) {
        this.reject(error);
      } else {
        this.resolve(value);
      }
    };
  }
}

export function addAll<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  for (const val of set2) {
    set1.add(val);
  }
  return set1;
}
