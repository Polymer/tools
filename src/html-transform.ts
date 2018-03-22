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
import * as parse5 from 'parse5';

import {jsTransform, JsTransformOptions} from './js-transform'

const p = dom5.predicates;

const isJsScriptNode = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')),
        p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

/**
 * Options for htmlTransform.
 */
export interface HtmlTransformOptions {
  /**
   * Transformations to apply to JavaScript within the HTML document.
   */
  js?: JsTransformOptions;

  /**
   * Whether this is the top-level "entry point" HTML document.
   */
  isEntryPoint?: boolean;

  /**
   * If js.transformEsModulesToAmd and isEntryPoint are both true (in which case
   * this parameter is required), a URL for the Require.Js library, for which a
   * script tag will be injected.
   */
  requireJsUrl?: string;
}

/**
 * Transform some HTML according to the given options.
 */
export function htmlTransform(
    html: string, options: HtmlTransformOptions): string {
  if (options.js && options.js.transformEsModulesToAmd &&
      options.isEntryPoint && !options.requireJsUrl) {
    throw new Error(
        'requireJsUrl is required when ' +
        'js.transformEsModulesToAmd and isEntryPoint are true.');
  }
  if (options.js && options.js.moduleResolution === 'node' &&
      !options.js.filePath) {
    throw new Error('Cannot perform node module resolution without filePath.');
  }

  const document = parse5.parse(html);
  const allScripts = dom5.queryAll(document, isJsScriptNode);

  let shouldTransformEsModuleToAmd = options.js &&
      options.js.transformEsModulesToAmd &&
      // Assume that if this document has a nomodule script, the author is
      // already handling browsers that don't support modules, and we don't
      // need to transform them (even if the configuration was set).
      !allScripts.some((node) => dom5.hasAttribute(node, 'nomodule'));

  let wctScript, firstModuleScript, finalModuleScript;
  let moduleScriptIdx = 0;

  for (const script of allScripts) {
    if (shouldTransformEsModuleToAmd &&
        dom5.getAttribute(script, 'type') === 'module') {
      transformEsModuleToAmd(script, moduleScriptIdx++, options.js);
      if (firstModuleScript === undefined) {
        firstModuleScript = script;
      }
      finalModuleScript = script;

    } else if (!dom5.hasAttribute(script, 'src')) {
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

  if (shouldTransformEsModuleToAmd) {
    // We need RequireJS to load the AMD modules we are declaring. Inject the
    // dependency as late as possible (just before the first module is
    // declared) because there may be some UMD dependencies that we want to
    // continue to load in global mode instead of AMD mode (which is detected
    // by the presence of the `require` global).
    if (firstModuleScript !== undefined && options.isEntryPoint) {
      const fragment = parse5.parseFragment(
          `<script src="${options.requireJsUrl}"></script>\n`);
      const requireJsScript = fragment.childNodes![0];
      dom5.insertBefore(
          firstModuleScript.parentNode!, firstModuleScript, fragment);

      if (wctScript !== undefined) {
        addWctTimingHack(wctScript, requireJsScript);
      }
    }

    // We've defined a bunch of modules and chained them together. Now we need
    // to initiate loading the chain by requiring the final one.
    if (finalModuleScript !== undefined) {
      const newJs = dom5.getTextContent(finalModuleScript) +
          `\nrequire(['${generateModuleName(moduleScriptIdx - 1)}']);`;
      dom5.setTextContent(finalModuleScript, newJs);
    }
  }

  return parse5.serialize(document);
}

function generateModuleName(idx: number): string {
  return `polymer-build-generated-module-${idx}`;
}

function transformEsModuleToAmd(
    script: dom5.Node, idx: number, jsOptions: JsTransformOptions|undefined) {
  // Module scripts execute in order. AMD modules don't necessarily preserve
  // this ordering. To emulate the ordering, we construct an artificial
  // dependency chain between all module scripts on the page.
  const generatedModule = generateModuleName(idx);
  const previousGeneratedModule =
      idx === 0 ? undefined : generateModuleName(idx - 1);

  // We're not a module anymore.
  dom5.removeAttribute(script, 'type');

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
    const depStr = previousGeneratedModule === undefined ?
        '' :
        `'${previousGeneratedModule}', `;
    const newJs =
        jsTransform(
            dom5.getTextContent(script),
            {...jsOptions, transformEsModulesToAmd: true})
            // The AMD Babel plugin will produce a `define` call with no name
            // argument, since it assumes its name corresponds to its file
            // name. This is an inline script, though, and we need a handle to
            // it for chaining, so insert a name argument.
            .replace('define([', `define('${generatedModule}', [${depStr}`);
    dom5.setTextContent(script, newJs);
  }
}

function addWctTimingHack(wctScript: dom5.Node, requireJsScript: dom5.Node) {
  // This looks like a Web Component Tester script, and we have converted ES
  // modules to AMD. Converting a module to AMD means that `DOMContentLoaded`
  // will fire before RequireJS resolves and executes the modules. Since WCT
  // listens for `DOMContentLoaded`, this means test suites in modules will not
  // have been registered by the time WCT starts running tests.
  //
  // To address this, we inject a block of JS that uses WCT's `waitFor` hook to
  // defer running tests until our AMD modules have loaded. If WCT finds a
  // `waitFor`, it passes it a callback that will run the tests, instead of
  // running tests immediately.
  //
  // Note we must do this as late as possible, before the WCT script, because
  // users may be setting their own `waitFor` that musn't clobber ours. Likewise
  // we must call theirs if we find it.
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
