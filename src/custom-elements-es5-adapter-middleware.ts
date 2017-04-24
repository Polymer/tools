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

import {parse as parseContentType} from 'content-type';
import {Request, RequestHandler, Response} from 'express';
import {addCustomElementsEs5Adapter} from 'polymer-build';

import {browserNeedsCompilation} from './compile-middleware';
import {transformResponse} from './transform-middleware';

/**
 * Returns an express middleware that injects the Custom Elements ES5 Adapter
 * into the entry point when we are serving ES5.
 *
 * This is a *transforming* middleware, so it must be installed before the
 * middleware that actually serves the entry point.
 */
export function injectCustomElementsEs5Adapter(forceCompile: boolean):
    RequestHandler {
  return transformResponse({
    shouldTransform(request: Request, _response: Response): boolean {
      // We only need to inject the adapter if we are compiling to ES5.
      return forceCompile ||
          browserNeedsCompilation(request.headers['user-agent']);
    },

    transform(_request: Request, response: Response, body: string): string {
      const contentTypeHeader = response.getHeader('Content-Type');
      const contentType =
          contentTypeHeader && parseContentType(contentTypeHeader).type;
      if (contentType === 'text/html') {
        // TODO(aomarks) This function will make no changes if the body does
        // not find a web components polyfill script tag. This is the heuristic
        // we use to determine if a file is the entry point. We would instead
        // be able to check explicitly for the entry point in `shouldTransform`
        // if we had the project config available.
        return addCustomElementsEs5Adapter(body);
      } else {
        return body;
      }
    },
  });
}
