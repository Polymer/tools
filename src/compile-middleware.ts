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

import * as babylon from 'babylon';
import {browserCapabilities} from 'browser-capabilities';
import {parse as parseContentType} from 'content-type';
import * as dom5 from 'dom5';
import {Request, RequestHandler, Response} from 'express';
import * as fs from 'fs';
import * as LRU from 'lru-cache';
import * as parse5 from 'parse5';
import * as path from 'path';
import {jsTransform} from 'polymer-build';
import {LocalFsPath} from 'polymer-build/lib/path-transformers';

import {transformResponse} from './transform-middleware';

const p = dom5.predicates;

const isJsScriptNode = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')),
        p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

const javaScriptMimeTypes = [
  'application/javascript',
  'application/ecmascript',
  'text/javascript',
  'text/ecmascript',
];

const htmlMimeType = 'text/html';

const compileMimeTypes = [htmlMimeType, ...javaScriptMimeTypes];

interface CompileOptions {
  transformES2015: boolean;
  transformModules: boolean;
}

// Match the polyfills from https://github.com/webcomponents/webcomponentsjs,
// but not their tests.
export const isPolyfill = /(^|\/)webcomponentsjs\/[^\/]+$/;

function getContentType(response: Response) {
  const contentTypeHeader = response.get('Content-Type');
  return contentTypeHeader && parseContentType(contentTypeHeader).type;
}

// NOTE: To change the max length of the cache at runtime, just use bracket
// notation, i.e. `babelCompileCache['max'] = 64 * 1024` for 64KB limit.
export const babelCompileCache = LRU<string>(<LRU.Options<string>>{
  length: (n: string, key: string) => n.length + key.length
});

// TODO(justinfagnani): see if we can just use the request path as the key
// See https://github.com/Polymer/polyserve/issues/248
export const getCompileCacheKey =
    (requestPath: string, body: string, options: any): string =>
        JSON.stringify(options) + requestPath + body;

export function babelCompile(
    compile: 'always'|'never'|'auto',
    moduleResolution: 'none'|'node',
    rootDir: string,
    packageName: string,
    componentUrl: string,
    componentDir: string): RequestHandler {
  return transformResponse({

    shouldTransform(request: Request, response: Response) {
      // We must never compile the Custom Elements ES5 Adapter or other
      // polyfills/shims.
      if (isPolyfill.test(request.url)) {
        return false;
      }
      if (!compileMimeTypes.includes(getContentType(response))) {
        return false;
      }
      if (compile === 'always' || moduleResolution === 'node') {
        return true;
      }
      if (compile === 'never') {
        return false;
      }
      const capabilities = browserCapabilities(request.get('user-agent'));
      return !capabilities.has('es2015') || !capabilities.has('modules');
    },

    transform(request: Request, response: Response, body: string): string {
      const capabilities = browserCapabilities(request.get('user-agent'));
      const options = {
        transformES2015: compile === 'always' || !capabilities.has('es2015'),
        transformModules: compile === 'always' || !capabilities.has('modules'),
      };

      const cacheKey =
          getCompileCacheKey(request.baseUrl + request.path, body, options);
      const cached = babelCompileCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      // Make sure that componentDir is absolute, like jsTransform expects
      componentDir = path.resolve(rootDir, componentDir);

      let transformed;
      const contentType = getContentType(response);
      let requestPath = request.path;
      // TODO(justinfagnani): Use path-is-inside, but test on Windows
      const isRootPathRequest = request.path.startsWith(`/${packageName}`);
      const isComponentRequest = request.baseUrl === `/${componentUrl}`;

      let filePath: string;

      if (isRootPathRequest) {
        requestPath = requestPath.substring(`/${packageName}`.length);
      }

      if (isComponentRequest && !isRootPathRequest) {
        filePath = path.join(componentDir, requestPath);
      } else {
        filePath = path.join(rootDir, requestPath);
      }

      // The file path needs to include the filename for correct relative
      // path calculation
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch (e) {
        // file not found, will 404 later
      }

      if (contentType === htmlMimeType) {
        transformed = compileHtml(
            body,
            filePath,
            isComponentRequest,
            packageName,
            componentUrl,
            moduleResolution,
            componentDir,
            rootDir,
            options);
      } else if (javaScriptMimeTypes.includes(contentType)) {
        transformed = jsTransform(body, {
          compileToEs5: options.transformES2015,
          transformEsModulesToAmd:
              options.transformModules && hasImportOrExport(body),
          moduleResolution,
          filePath: filePath as LocalFsPath,
          isComponentRequest,
          packageName,
          componentDir,
          rootDir,
        });
      } else {
        transformed = body;
      }
      babelCompileCache.set(cacheKey, transformed);
      return transformed;
    },
  });
}

function compileHtml(
    source: string,
    filePath: string,
    isComponentRequest: boolean,
    packageName: string,
    componentUrl: string,
    moduleResolution: 'none'|'node',
    componentDir: string,
    rootDir: string,
    options: CompileOptions): string {
  const document = parse5.parse(source);
  let requireScriptTag, wctScriptTag;

  const jsNodes = dom5.queryAll(document, isJsScriptNode);

  // Assume that if this document has a nomodule script, the author is
  // already handling browsers that don't support modules, and we don't need
  // to transform anything.
  // TODO(aomarks) Shouldn't this only affect module transform?
  if (jsNodes.find((node) => dom5.hasAttribute(node, 'nomodule'))) {
    return source;
  }

  for (const scriptTag of jsNodes) {
    // Is this a module script we should transform?
    const transformingModule = options.transformModules &&
        dom5.getAttribute(scriptTag, 'type') === 'module';

    if (transformingModule && !requireScriptTag) {
      // We need RequireJS to load the AMD modules we are declaring. Inject
      // the dependency as late as possible (right before the first module
      // is declared) because some of our legacy non-module dependencies,
      // typically loaded in <head>, behave differently when window.require
      // is present.
      const fragment = parse5.parseFragment(
          `<script src="/${componentUrl}/requirejs/require.js"></script>\n`);
      requireScriptTag = fragment.childNodes[0];
      dom5.insertBefore(scriptTag.parentNode, scriptTag, fragment);
    }

    const src = dom5.getAttribute(scriptTag, 'src');
    const isInline = !src;

    if (src &&
        (src.includes('web-component-tester/browser.js') ||
         src.includes('wct-browser-legacy/browser.js'))) {
      wctScriptTag = scriptTag;
    }

    if (transformingModule && !isInline) {
      // Transform an external module script into a `require` for that
      // module, to be executed immediately.
      dom5.replace(
          scriptTag,
          parse5.parseFragment(`<script>require(["${src}"]);</script>\n`));

    } else if (isInline) {
      let js = dom5.getTextContent(scriptTag);
      let compiled;
      try {
        compiled = jsTransform(js, {
          compileToEs5: options.transformES2015,
          transformEsModulesToAmd: transformingModule,
          moduleResolution,
          filePath: filePath as any,
          isComponentRequest,
          packageName,
          componentDir,
          rootDir,
        });
      } catch (e) {
        // Continue so that we leave the original script as-is. It might
        // work?
        // TODO Show an error in the browser console, or on the runner page.
        console.warn(`Error compiling script in ${filePath}: ${e.message}`);
        continue;
      }

      if (transformingModule) {
        // The Babel AMD transformer output always starts with a `define`
        // call, which registers a module but does not execute it
        // immediately. Since we're in HTML, these are our top-level
        // scripts, and we want them to execute immediately. Swap it out for
        // `require` so that it does.
        compiled = compiled.replace('define', 'require');

        // Remove type="module" since this is non-module JavaScript now.
        dom5.removeAttribute(scriptTag, 'type');
      }

      dom5.setTextContent(scriptTag, compiled);
    }
  }

  if (wctScriptTag && requireScriptTag) {
    // This looks like a Web Component Tester script, and we have converted
    // ES modules to AMD. Converting a module to AMD means that
    // `DOMContentLoaded` will fire before RequireJS resolves and executes
    // the modules. Since WCT listens for `DOMContentLoaded`, this means
    // test suites in modules will not have been registered by the time WCT
    // starts running tests.
    //
    // To address this, we inject a block of JS that uses WCT's `waitFor`
    // hook to defer running tests until our AMD modules have loaded. If WCT
    // finds a `waitFor`, it passes it a callback that will run the tests,
    // instead of running tests immediately.
    //
    // Note we must do this as late as possible, before the WCT script,
    // because users may be setting their own `waitFor` that musn't clobber
    // ours. Likewise we must call theirs if we find it.
    dom5.insertBefore(
        wctScriptTag.parentNode, wctScriptTag, parse5.parseFragment(`
<script>
  // Injected by Polyserve.
  (function() {
    window.WCT = window.WCT || {};
    var originalWaitFor = window.WCT.waitFor;
    window.WCT.waitFor = function(cb) {
      window._wctCallback = function() {
        if (originalWaitFor) {
          originalWaitFor(cb);
        } else {
          cb();
        }
      };
    };
  }());
</script>
`));

    // Monkey patch `require` to keep track of loaded AMD modules. Note this
    // assumes that all modules are registered before `DOMContentLoaded`,
    // but that's an assumption WCT normally makes anyway. Do this right
    // after RequireJS is loaded, and hence before the first module is
    // registered.
    //
    // TODO We may want to detect when the module failed to load (e.g. the
    // deps couldn't be resolved, or the factory threw an exception) and
    // show a nice message. For now test running will just hang if any
    // module fails.
    dom5.insertAfter(
        requireScriptTag.parentNode, requireScriptTag, parse5.parseFragment(`
<script>
  // Injected by Polyserve.
  (function() {
    var originalRequire = window.require;
    var moduleCount = 0;
    window.require = function(deps, factory) {
      moduleCount++;
      originalRequire(deps, function() {
        if (factory) {
          factory.apply(undefined, arguments);
        }
        moduleCount--;
        if (moduleCount === 0) {
          window._wctCallback();
        }
      });
    };
  })();
</script>
`));
  }

  return parse5.serialize(document);
}

function hasImportOrExport(js: string): boolean {
  let ast;
  try {
    ast = babylon.parse(js, {sourceType: 'module'});
  } catch (e) {
    return false;
  }
  for (const node of ast.program.body) {
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        return true;
    }
  }
  return false;
}
