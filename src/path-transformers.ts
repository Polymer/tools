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

/**
 * CODE ADAPTED FROM THE "SLASH" LIBRARY BY SINDRE SORHUS
 * https://github.com/sindresorhus/slash
 *
 * ORIGINAL LICENSE:
 * The MIT License (MIT)
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)*
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy*
 * of this software and associated documentation files (the "Software"), to
 * deal*
 * in the Software without restriction, including without limitation the rights*
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell*
 * copies of the Software, and to permit persons to whom the Software is*
 * furnished to do so, subject to the following conditions:*
 *
 * The above copyright notice and this permission notice shall be included in*
 * all copies or substantial portions of the Software.*
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR*
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,*
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE*
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER*
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM,*
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN*
 * THE SOFTWARE.
 */

import * as path from 'path';

export function isPlatformWindows(): boolean {
  return /^win/.test(process.platform);
}

export function platformifyPath(filepath: string): string {
  // Replace all / with \ if win32 otherwise nothing.
  // TODO(usergenic): Should we produce an "extended-length path" in win32 if
  // the path length is over 259 on win32?
  return filepath.replace(/\//g, path.sep);
}

export function posixifyPath(filepath: string): string {
  if (isPlatformWindows()) {
    // Strip "extended-length path" prefix.
    filepath = filepath.replace(/^\\\\\?\\/, '');
    // Replace all \ with /
    filepath = filepath.replace(/\\/g, '/');
  }
  return filepath;
}

export function urlFromPath(root: string, filepath: string) {
  filepath = posixifyPath(filepath);
  root = posixifyPath(root);

  if (!filepath.startsWith(root)) {
    throw new Error(`file path is not in root: ${filepath} (${root})`);
  }

  // The goal is a relative URL from the root, so strip out the root and the
  // leading slash, so '/my-app/subfolder/file.html' => 'subfolder/file.html'
  return encodeURI(filepath.replace(root, '').replace(/^\//, ''));
}

export function pathFromUrl(root: string, url: string) {
  return platformifyPath(decodeURI(path.join(root, url)));
}
