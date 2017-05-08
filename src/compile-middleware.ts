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

import * as babelCore from 'babel-core';
import {parse as parseContentType} from 'content-type';
import * as dom5 from 'dom5';
import {Request, RequestHandler, Response} from 'express';
import * as LRU from 'lru-cache';
import * as parse5 from 'parse5';
import {UAParser} from 'ua-parser-js';
import * as url from 'url';

import {transformResponse} from './transform-middleware';

const babelTransformers = [
  'babel-plugin-transform-es2015-arrow-functions',
  'babel-plugin-transform-es2015-block-scoped-functions',
  'babel-plugin-transform-es2015-block-scoping',
  'babel-plugin-transform-es2015-classes',
  'babel-plugin-transform-es2015-computed-properties',
  'babel-plugin-transform-es2015-destructuring',
  'babel-plugin-transform-es2015-duplicate-keys',
  'babel-plugin-transform-es2015-for-of',
  'babel-plugin-transform-es2015-function-name',
  'babel-plugin-transform-es2015-literals',
  'babel-plugin-transform-es2015-object-super',
  'babel-plugin-transform-es2015-parameters',
  'babel-plugin-transform-es2015-shorthand-properties',
  'babel-plugin-transform-es2015-spread',
  'babel-plugin-transform-es2015-sticky-regex',
  'babel-plugin-transform-es2015-template-literals',
  'babel-plugin-transform-es2015-typeof-symbol',
  'babel-plugin-transform-es2015-unicode-regex',
  'babel-plugin-transform-regenerator',
].map((name) => require(name));

const javaScriptMimeTypes = [
  'application/javascript',
  'application/ecmascript',
  'text/javascript',
  'text/ecmascript',
];

const htmlMimeType = 'text/html';

const compileMimeTypes = [
  htmlMimeType,
].concat(javaScriptMimeTypes);

function getContentType(response: Response) {
  const contentTypeHeader = response.getHeader('Content-Type');
  return contentTypeHeader && parseContentType(contentTypeHeader).type;
}

// NOTE: To change the max length of the cache at runtime, just use bracket
// notation, i.e. `babelCompileCache['max'] = 64 * 1024` for 64KB limit.
export const babelCompileCache = LRU<string>(<LRU.Options<string>>{
  length: (n: string, key: string) => n.length + key.length
});


export function babelCompile(forceCompile: boolean): RequestHandler {
  return transformResponse({
    shouldTransform(request: Request, response: Response) {
      // We must never compile the Custom Elements ES5 Adapter or other
      // polyfills/shims.
      const isPolyfill = url.parse(request.url)
                             .pathname.split('/')
                             .includes('webcomponentsjs');
      return !isPolyfill &&
          compileMimeTypes.includes(getContentType(response)) &&
          (forceCompile ||
           browserNeedsCompilation(request.headers['user-agent']));
    },

    transform(request: Request, response: Response, body: string): string {
      const contentType = getContentType(response);
      const source = body;
      const cached = babelCompileCache.get(source);
      if (cached !== undefined) {
        return cached;
      }
      if (contentType === htmlMimeType) {
        body = compileHtml(source, request.path);
      }
      if (javaScriptMimeTypes.includes(contentType)) {
        body = compileScript(source);
      }
      babelCompileCache.set(source, body);

      return body;
    },
  });
}

function compileHtml(source: string, location: string): string {
  const document = parse5.parse(source);
  const scriptTags = dom5.queryAll(document, isInlineJavaScript);
  for (const scriptTag of scriptTags) {
    try {
      const script = dom5.getTextContent(scriptTag);
      const compiledScriptResult = compileScript(script);
      dom5.setTextContent(scriptTag, compiledScriptResult);
    } catch (e) {
      // By not setting textContent we keep the original script, which
      // might work. We may want to fail the request so a better error
      // shows up in the network panel of dev tools. If this is the main
      // page we could also render a message in the browser.
      console.warn(`Error compiling script in ${location}: ${e.message}`);
    }
  }
  return parse5.serialize(document);
}

function compileScript(script: string): string {
  return babelCore
      .transform(script, {
        plugins: babelTransformers,
      })
      .code;
}

const isInlineJavaScript = dom5.predicates.AND(
    dom5.predicates.hasTagName('script'),
    dom5.predicates.NOT(dom5.predicates.hasAttr('src')));

export function browserNeedsCompilation(userAgent: string): boolean {
  const browser = new UAParser(userAgent).getBrowser();
  const versionSplit = (browser.version || '').split('.');
  const [majorVersion, minorVersion] =
      versionSplit.map((v) => v ? parseInt(v, 10) : -1);

  const supportsES2015 = (browser.name === 'Chrome' && majorVersion >= 49) ||
      (browser.name === 'Chromium' && majorVersion >= 49) ||
      (browser.name === 'OPR' && majorVersion >= 36) ||
      (browser.name === 'Vivaldi' && majorVersion >= 1) ||
      (browser.name === 'Mobile Safari' && majorVersion >= 10) ||
      (browser.name === 'Safari' && majorVersion >= 10) ||
      // Note: The Edge user agent uses the EdgeHTML version, not the main
      // release version (e.g. EdgeHTML 15 corresponds to Edge 40). See
      // https://en.wikipedia.org/wiki/Microsoft_Edge#Release_history.
      //
      // Versions before 15.15063 may contain a JIT bug affecting ES6
      // constructors (see #161).
      (browser.name === 'Edge' &&
       (majorVersion > 15 || (majorVersion === 15 && minorVersion >= 15063))) ||
      (browser.name === 'Firefox' && majorVersion >= 51);
  return !supportsES2015;
}
