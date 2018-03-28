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

import {assert} from 'chai';
import * as path from 'path';
import {Warning, WarningPrinter} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../linter';
import {registry} from '../registry';
import {stripWhitespace} from '../util';

const fixtures_dir = path.resolve(
    path.join(__dirname, '../../test/integration/bower_components'));

// These tests aren't hermetic, as they depend on a lot of upstream code,
// so they don't run by default.
if (process.env['INTEGRATION_TEST']) {
  suite('integration tests', function() {

    // Analyzing and linting 36MB of code takes longer than 2s.
    this.timeout(60 * 1000);

    test(`polymer team's elements lint clean`, async() => {
      const {analyzer} =
          await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir);
      const linter =
          new Linter(registry.getRules(['polymer-2-hybrid']), analyzer);
      const warnings = filterWarnings((await linter.lintPackage()).warnings);

      const warningPrinter =
          new WarningPrinter(process.stdout, {color: true, verbosity: 'full'});
      warningPrinter.printWarnings(warnings);

      assert.equal(warnings.length, 0, 'Got unexpected warnings');
    });
  });
}

const codesToIgnore = new Set([
  // We have a lot of references to files which aren't published on bower.
  // (e.g. demos, tests, dev dependencies, etc).
  // No current plan to track these down and fix them, as there's just so many.
  'could-not-load',
]);

const fileSpecificIgnoreCodesToIgnore: {[path: string]: Set<string>} = {
  // https://github.com/PolymerElements/paper-scroll-header-panel/pull/106
  'paper-scroll-header-panel/demo/lorem-ipsum.html':
      new Set(['dom-module-invalid-attrs']),

  // https://github.com/PolymerElements/iron-a11y-keys-behavior/pull/66
  'iron-a11y-keys-behavior/test/basic-test.html':
      new Set(['unknown-polymer-behavior']),

  // https://github.com/PolymerLabs/note-app-elements/pull/5
  'note-app-elements/na-behavior.html': new Set(['unknown-polymer-behavior']),

  // https://github.com/PolymerElements/iron-resizable-behavior/pull/25
  'iron-resizable-behavior/test/test-elements.html':
      new Set(['unknown-polymer-behavior']),

  // https://github.com/Polymer/polymer-analyzer/issues/458
  'hydrolysis/custom_typings/escodegen.d.ts': new Set(['unable-to-analyze']),
  'hydrolysis/custom_typings/espree.d.ts': new Set(['unable-to-analyze']),
  'hydrolysis/custom_typings/estraverse.d.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/analyzer.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/analyze-properties.ts':
      new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/ast-value.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/behavior-finder.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/declaration-property-handlers.ts':
      new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/descriptors.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/docs.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/element-finder.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/esutil.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/feature-finder.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/fluent-traverse.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/import-parse.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/js-parse.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/ast-utils/jsdoc.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/error-swallowing-fs-resolver.ts':
      new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/file-loader.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/fs-resolver.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/redirect-resolver.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/noop-resolver.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/string-resolver.ts': new Set(['unable-to-analyze']),
  'hydrolysis/src/loader/xhr-resolver.ts': new Set(['unable-to-analyze']),

  // https://github.com/PolymerElements/app-layout/pull/412
  'app-layout/templates/publishing/src/blog-app.html':
      new Set(['polymer-expression-parse-error']),

  // https://github.com/PolymerElements/iron-doc-viewer/pull/98
  'iron-doc-viewer/iron-doc-property.html':
      new Set(['polymer-expression-parse-error']),

  // https://github.com/PolymerElements/iron-location/pull/68
  'iron-location/test/initialization-cases.html':
      new Set(['set-unknown-attribute']),

  // https://github.com/PolymerLabs/note-app-elements/pull/6
  'note-app-elements/na-editor.html': new Set(['undefined-elements']),

  // Chai includes a lot of modules, with @namespace declarations that
  // overlap.
  'chai/chai.js': new Set(['multiple-javascript-namespaces']),

  // This is a template file, and it contains a malformed url.
  'web-component-tester/data/index.html': new Set(['unable-to-analyze']),

  // https://github.com/PolymerElements/paper-dropdown-menu/pull/232
  'paper-dropdown-menu/paper-dropdown-menu-light.html':
      new Set(['databind-with-unknown-property']),

  // https://github.com/PolymerElements/paper-input/pull/489
  'paper-input/paper-input.html': new Set(['databind-with-unknown-property']),

  // https://github.com/PolymerElements/app-layout/pull/426
  'app-layout/site/device-viewer/device-layout-viewer.html':
      new Set(['databind-with-unknown-property']),

  // This file has a really long observer that's broken into two string
  // literals spread across two lines.
  'iron-ajax/iron-ajax.html': new Set(['unanalyzable-polymer-expression']),

  // https://github.com/PolymerElements/app-route/pull/183
  'app-route/demo/youtube-demo/youtube-search.html':
      new Set(['databinding-calls-must-be-functions']),

  // https://github.com/PolymerElements/app-layout/pull/423
  'app-layout/patterns/transform-navigation/x-app.html':
      new Set(['set-unknown-attribute']),

  // https://github.com/PolymerElements/app-route/pull/182
  'app-route/demo/data-loading-demo/flickr-search-demo.html':
      new Set(['set-unknown-attribute']),

  // We have a few node binary scripts which start with a shebang.
  // https://github.com/Polymer/polymer-analyzer/issues/435
  'pouchdb-find/bin/dev-server.js': new Set(['parse-error']),
  'pouchdb-find/bin/es3ify.js': new Set(['parse-error']),
  'pouchdb-find/bin/test-browser.js': new Set(['parse-error']),
  'async/perf/benchmark.js': new Set(['parse-error']),
  'async/support/sync-package-managers.js': new Set(['parse-error']),
};

const codesOkInTestsAndDemos = new Set([
  // We've got a number of places in our tests and demos where code needs an
  // element but doesn't directly depend on it. Should probably be fixed, but
  // as it's only ever used in one place it's not important.
  'undefined-elements',

  // We define lots of elements in demos and tests for whom we don't declare all
  // of their properties. Mea culpa!
  'databind-with-unknown-property',
]);

// Filter out known issues in the codebase.
function filterWarnings(warnings: ReadonlyArray<Warning>) {
  const unfoundCodes = new Set(codesToIgnore);
  const unfoundCodesByFile: typeof fileSpecificIgnoreCodesToIgnore = {};
  for (const key in fileSpecificIgnoreCodesToIgnore) {
    unfoundCodesByFile[key] = new Set(fileSpecificIgnoreCodesToIgnore[key]);
  }

  const filteredWarnings = warnings.filter((w) => {
    if (codesToIgnore.has(w.code)) {
      unfoundCodes.delete(w.code);
      return false;
    }
    const fileCodes =
        fileSpecificIgnoreCodesToIgnore[w.sourceRange.file] || new Set();
    if (fileCodes.has(w.code)) {
      unfoundCodesByFile[w.sourceRange.file].delete(w.code);
      return false;
    }
    if (codesOkInTestsAndDemos.has(w.code) &&
        /\/(test|demo)\//.test(w.sourceRange.file)) {
      return false;
    }
    if (w.sourceRange.file.startsWith('app-layout/templates/')) {
      // This is a bug in the integration test runner. These templates all
      // have their own bower.json files, so we should run bower install on
      // them.
      return false;
    }
    return true;
  });

  for (const code of unfoundCodes) {
    console.warn(stripWhitespace(`
        Didn't find any warnings with code ${code} --
        it shouldn't be ignored.`));
  }
  for (const filename in unfoundCodesByFile) {
    for (const code of unfoundCodesByFile[filename]) {
      console.warn(stripWhitespace(`
          Didn't find any warnings with code ${code} in file ${filename} --
          it shouldn't be ignored.`));
    }
  }

  return filteredWarnings;
}
