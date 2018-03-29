/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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
import * as fs from 'fs';
import * as htmlMinifier from 'html-minifier';
import * as parse5 from 'parse5';
import * as pathlib from 'path';

import {scriptWasSplitByHtmlSplitter} from './html-splitter'
import {generateModuleName, jsTransform, JsTransformOptions} from './js-transform'

const p = dom5.predicates;

const isJsScript = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')),
        p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

const isJsScriptOrHtmlImport = p.OR(
    isJsScript,
    p.AND(p.hasTagName('link'), p.hasSpaceSeparatedAttrValue('rel', 'import')));

/**
 * Options for htmlTransform.
 */
export interface HtmlTransformOptions {
  /**
   * Transformations to apply to JavaScript within the HTML document.
   */
  js?: JsTransformOptions;

  /**
   * Whether to minify HTML.
   */
  minifyHtml?: boolean;

  /**
   * Whether to inject Babel helpers as an inline script. This is typically
   * needed if ES5 compilation is enabled and this is the entry point HTML
   * document.
   */
  injectBabelHelpers?: boolean;

  /**
   * Whether to inject an AMD loader as an inline script. This might be
   * RequireJS, or something else in the future. This is typically needed if ES
   * to AMD module transformation is enabled and this is the entry point HTML
   * document.
   */
  injectAmdLoader?: boolean;
}

/**
 * Transform some HTML according to the given options.
 */
export function htmlTransform(
    html: string, options: HtmlTransformOptions): string {
  if (options.js && options.js.moduleResolution === 'node' &&
      !options.js.filePath) {
    throw new Error('Cannot perform node module resolution without filePath.');
  }

  const document = parse5.parse(html, {
    locationInfo: true,  // Required for removeFakeNodes.
  });
  removeFakeNodes(document);
  const allScripts = dom5.queryAll(document, isJsScript);

  let shouldTransformEsModuleToAmd = options.js &&
      options.js.transformEsModulesToAmd &&
      // Assume that if this document has a nomodule script, the author is
      // already handling browsers that don't support modules, and we don't
      // need to transform them (even if the configuration was set).
      // TODO(aomarks) Check this for HtmlSplitter case too.
      !allScripts.some((node) => dom5.hasAttribute(node, 'nomodule'));

  let wctScript, firstModuleScript, finalModuleScript;
  let moduleScriptIdx = 0;

  for (const script of allScripts) {
    const isModule = dom5.getAttribute(script, 'type') === 'module';
    if (isModule) {
      if (firstModuleScript === undefined) {
        firstModuleScript = script;
      }
      finalModuleScript = script;
      if (shouldTransformEsModuleToAmd) {
        transformEsModuleToAmd(script, moduleScriptIdx++, options.js);
        continue;  // Bypass the standard jsTransform below.
      }
    }

    const isInline = !dom5.hasAttribute(script, 'src');
    if (isInline) {
      // Note that scripts split by HtmlSplitter are always external, so we
      // don't have to check for that case here.
      const newJs = jsTransform(
          dom5.getTextContent(script),
          {...options.js, transformEsModulesToAmd: false});
      dom5.setTextContent(script, newJs);

    } else if (wctScript === undefined) {
      const src = dom5.getAttribute(script, 'src') || '';
      if (src.includes('web-component-tester/browser.js') ||
          src.includes('wct-browser-legacy/browser.js')) {
        wctScript = script;
      }
    }
  }

  if (shouldTransformEsModuleToAmd && finalModuleScript !== undefined) {
    // We've defined a bunch of modules and chained them together. Now we need
    // to initiate loading the chain by requiring the final one.
    const finalModuleName = generateModuleName(moduleScriptIdx - 1);
    const fragment = parse5.parseFragment(
        `<script>require(['${finalModuleName}']);</script>`);
    dom5.insertAfter(
        finalModuleScript.parentNode!, finalModuleScript, fragment);
  }

  if (options.injectAmdLoader && shouldTransformEsModuleToAmd &&
      firstModuleScript !== undefined) {
    const fragment = parse5.parseFragment('<script></script>\n');
    dom5.setTextContent(fragment.childNodes![0], getMinifiedRequireJs());
    const requireJsScript = fragment.childNodes![0];

    // Inject as late as possible (just before the first module is declared, if
    // there is one) because there may be some UMD dependencies that we want to
    // continue to load in global mode instead of AMD mode (which is detected by
    // the presence of the `require` global).
    dom5.insertBefore(
        firstModuleScript.parentNode!, firstModuleScript, fragment);

    if (wctScript !== undefined) {
      addWctTimingHack(wctScript, requireJsScript);
    }
  }

  if (options.injectBabelHelpers) {
    const fragment = parse5.parseFragment('<script></script>\n');
    dom5.setTextContent(fragment.childNodes![0], getMinifiedBabelHelpers());

    const firstJsScriptOrHtmlImport =
        dom5.nodeWalk(document, isJsScriptOrHtmlImport);
    if (firstJsScriptOrHtmlImport) {
      dom5.insertBefore(
          firstJsScriptOrHtmlImport.parentNode!,
          firstJsScriptOrHtmlImport,
          fragment);

    } else {
      const headOrDocument =
          dom5.query(document, dom5.predicates.hasTagName('head')) || document;
      dom5.append(headOrDocument, fragment);
    }
  }

  html = parse5.serialize(document);

  if (options.minifyHtml) {
    html = htmlMinifier.minify(html, {
      collapseWhitespace: true,
      removeComments: true,
    });
  }

  return html;
}

function transformEsModuleToAmd(
    script: dom5.Node, idx: number, jsOptions: JsTransformOptions|undefined) {
  // We're not a module anymore.
  dom5.removeAttribute(script, 'type');

  if (scriptWasSplitByHtmlSplitter(script)) {
    // Nothing else to do here. If we're using HtmlSplitter, the JsTransformer
    // is responsible for doing this transformation.
    return;
  }

  // Module scripts execute in order. AMD modules don't necessarily preserve
  // this ordering. To emulate the ordering, we construct an artificial
  // dependency chain between all module scripts on the page.
  const generatedModule = generateModuleName(idx);
  const previousGeneratedModule =
      idx === 0 ? undefined : generateModuleName(idx - 1);

  const isExternal = dom5.hasAttribute(script, 'src');
  if (isExternal) {
    const deps = [];
    if (previousGeneratedModule !== undefined) {
      deps.push(previousGeneratedModule);
    }
    const externalSrc = dom5.getAttribute(script, 'src');
    deps.push(externalSrc);
    const depsStr = deps.map((dep) => `'${dep}'`).join(', ');
    dom5.removeAttribute(script, 'src');
    dom5.setTextContent(script, `define('${generatedModule}', [${depsStr}]);`);

  } else {
    // Transform inline scripts with the AMD Babel plugin transformer.
    const newJs = jsTransform(dom5.getTextContent(script), {
      ...jsOptions,
      transformEsModulesToAmd: true,
      moduleScriptIdx: idx,
    });
    dom5.setTextContent(script, newJs);
  }
}

function addWctTimingHack(wctScript: dom5.Node, requireJsScript: dom5.Node) {
  // This looks like a Web Component Tester script, and we have converted ES
  // modules to AMD. Converting a module to AMD means that `DOMContentLoaded`
  // will fire before RequireJS resolves and executes the modules. Since WCT
  // listens for `DOMContentLoaded`, this means test suites in modules will
  // not have been registered by the time WCT starts running tests.
  //
  // To address this, we inject a block of JS that uses WCT's `waitFor` hook
  // to defer running tests until our AMD modules have loaded. If WCT finds a
  // `waitFor`, it passes it a callback that will run the tests, instead of
  // running tests immediately.
  //
  // Note we must do this as late as possible, before the WCT script, because
  // users may be setting their own `waitFor` that musn't clobber ours.
  // Likewise we must call theirs if we find it.
  dom5.insertBefore(wctScript.parentNode!, wctScript, parse5.parseFragment(`
<script>
  // Injected by polymer-build to defer WCT until all AMD modules are loaded.
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
  // assumes that all modules are registered before `DOMContentLoaded`, but
  // that's an assumption WCT normally makes anyway. Do this right after
  // RequireJS is loaded, and hence before the first module is registered.
  dom5.insertAfter(
      requireJsScript.parentNode!, requireJsScript, parse5.parseFragment(`
<script>
  // Injected by polymer-build to defer WCT until all AMD modules are loaded.
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

let minifiedBabelHelpers: string;
function getMinifiedBabelHelpers() {
  if (minifiedBabelHelpers === undefined) {
    minifiedBabelHelpers = fs.readFileSync(
        pathlib.join(__dirname, 'babel-helpers.min.js'), 'utf-8');
  }
  return minifiedBabelHelpers;
}

let minifiedRequireJs: string;
function getMinifiedRequireJs() {
  if (minifiedRequireJs === undefined) {
    minifiedRequireJs =
        fs.readFileSync(pathlib.join(__dirname, 'requirejs.min.js'), 'utf-8');
  }
  return minifiedRequireJs;
}

/**
 * parse5 will inject <html>, <head>, and <body> tags if they aren't already
 * there. Undo this so that we make fewer unnecessary transformations.
 *
 * Note that the given document must have been parsed with `locationInfo: true`,
 * or else this function will always remove these tags.
 *
 * TODO(aomarks) Move to dom5.
 */
function removeFakeNodes(document: dom5.Node) {
  const suspects = [];
  const html =
      (document.childNodes || []).find((child) => child.tagName === 'html');
  if (html !== undefined) {
    suspects.push(html);
    for (const child of html.childNodes || []) {
      if (child.tagName === 'head' || child.tagName === 'body') {
        suspects.push(child);
      }
    }
  }
  for (const suspect of suspects) {
    // No location means it wasn't in the original source.
    if (!suspect.__location) {
      dom5.removeNodeSaveChildren(suspect);
    }
  }
}
