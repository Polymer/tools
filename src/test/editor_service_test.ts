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

import {assert} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import {RemoteEditorService} from '../editor-server';
import {AttributesCompletion, BaseEditor, EditorService, ElementCompletion, Severity, Warning} from '../editor-service';
import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';

import {invertPromise} from './test-utils';

function editorTests(editorFactory: (basedir: string) => BaseEditor) {
  const basedir = path.join(__dirname, 'static');
  const indexFile = path.join('editor-service', 'index.html');
  const tagPosition = {line: 7, column: 9};
  const tagPositionEnd = {line: 7, column: 21};
  const localAttributePosition = {line: 7, column: 31};
  const deepAttributePosition = {line: 7, column: 49};
  const elementTypeahead: ElementCompletion = {
    kind: 'element-tags',
    elements: [
      {
        tagname: 'behavior-test-elem',
        description: 'An element to test out behavior inheritance.',
        expandTo: undefined
      },
      {description: '', tagname: 'class-declaration', expandTo: undefined},
      {description: '', tagname: 'anonymous-class', expandTo: undefined},
      {description: '', tagname: 'class-expression', expandTo: undefined},
      {
        description: '',
        tagname: 'register-before-declaration',
        expandTo: undefined
      },
      {
        description: '',
        tagname: 'register-before-expression',
        expandTo: undefined
      },
      {
        description: 'This is a description of WithObservedAttributes.',
        tagname: 'vanilla-with-observed-attributes',
        expandTo: undefined
      },
    ]
  };
  // Like elementTypeahead, but we also want to add a leading < because we're
  // in a context where we don't have one.
  const emptyStartElementTypeahead = Object.assign({}, elementTypeahead);
  emptyStartElementTypeahead.elements =
      emptyStartElementTypeahead.elements.map(e => {
        let copy = Object.assign({}, e);
        let space = '';
        const elementsWithAttributes =
            new Set(['vanilla-with-observed-attributes', 'behavior-test-elem']);
        if (elementsWithAttributes.has(e.tagname)) {
          space = ' ';
        }
        copy.expandTo = `<${e.tagname}${space}></${e.tagname}>`;
        return copy;
      });
  const attributeTypeahead: AttributesCompletion = {
    kind: 'attributes',
    attributes: [
      {
        name: 'local-property',
        description: 'A property defined directly on behavior-test-elem.',
        type: 'boolean',
        sortKey: 'aaa-local-property',
        inheritedFrom: undefined,
      },
      {
        name: 'inherit-please',
        description: 'A property provided by SimpleBehavior.',
        type: 'number',
        sortKey: 'ddd-inherit-please',
        inheritedFrom: 'MyNamespace.SimpleBehavior',
      },
      {
        name: 'deeply-inherited-property',
        description: 'This is a deeply inherited property.',
        type: 'Array',
        sortKey: 'ddd-deeply-inherited-property',
        inheritedFrom: 'MyNamespace.SubBehavior',
      },
      {
        name: 'on-local-property-changed',
        description: 'Fired when the `localProperty` property changes.',
        type: 'CustomEvent',
        sortKey: 'eee-aaa-on-local-property-changed',
        inheritedFrom: undefined,
      },
      {
        name: 'on-inherit-please-changed',
        description: 'Fired when the `inheritPlease` property changes.',
        type: 'CustomEvent',
        sortKey: 'eee-ddd-on-inherit-please-changed',
        inheritedFrom: 'MyNamespace.SimpleBehavior',
      },
      {
        name: 'on-deeply-inherited-property-changed',
        description:
            'Fired when the `deeplyInheritedProperty` property changes.',
        type: 'CustomEvent',
        sortKey: 'eee-ddd-on-deeply-inherited-property-changed',
        inheritedFrom: 'MyNamespace.SubBehavior',
      },
    ]
  };
  const indexContents = fs.readFileSync(path.join(basedir, indexFile), 'utf-8');

  // The weird cast is because the service will always be non-null when we
  // actually use it.
  let editorService: BaseEditor = <EditorService><any>null;
  setup(async function() {
    editorService = editorFactory(basedir);
  });

  suite('getDocumentationFor', function() {
    const tagDescription = 'An element to test out behavior inheritance.';
    const localAttributeDescription =
        '{boolean} A property defined directly on behavior-test-elem.';
    const deepAttributeDescription =
        '{Array} This is a deeply inherited property.';

    let testName = 'it supports getting the element description ' +
        'when asking for docs at its tag name';

    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(indexFile, tagPosition),
          tagDescription);
    });

    testName = 'it can still get element info after changing a file in memory';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const contents = fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      // Add a newline at the beginning of the file, shifting the lines
      // down.
      await editorService.fileChanged(indexFile, `\n${contents}`);

      assert.equal(
          await editorService.getDocumentationFor(indexFile, tagPosition),
          undefined);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile,
              {line: tagPosition.line + 1, column: tagPosition.column}),
          tagDescription, );
    });

    test('it supports getting an attribute description', async function() {
      await editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile, localAttributePosition),
          localAttributeDescription);
    });

    testName = 'it supports getting a description of an attribute ' +
        'defined in a behavior';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile, deepAttributePosition),
          deepAttributeDescription);
    });
  });

  suite('getDefinitionFor', function() {
    let testName = `it supports getting the definition of ` +
        `an element from its tag`;
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(await editorService.getDefinitionFor(indexFile, tagPosition), {
        file: 'analysis/behaviors/elementdir/element.html',
        start: {line: 4, column: 10},
        end: {line: 24, column: 3}
      });
    });

    testName = 'it supports getting the definition of a local attribute';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(
          await editorService.getDefinitionFor(
              indexFile, localAttributePosition),
          {
            file: 'analysis/behaviors/elementdir/element.html',
            start: {line: 9, column: 6},
            end: {line: 13, column: 7}
          });
    });

    testName = 'it supports getting the definition of an attribute ' +
        'defined in a behavior';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(
          await editorService.getDefinitionFor(
              indexFile, deepAttributePosition),
          {
            file: 'analysis/behaviors/subdir/subbehavior.html',
            start: {line: 5, column: 6},
            end: {line: 11, column: 7}
          });
    });

  });

  suite('getTypeaheadCompletionsFor', function() {
    let testName = 'Get element completions for an empty text region.';
    test(testName, async function() {
      await editorService.fileChanged(indexFile, `\n${indexContents}`);
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, {line: 0, column: 0}),
          emptyStartElementTypeahead);
    });

    testName = 'Get element completions for a start tag.';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, tagPosition),
          elementTypeahead);
    });

    testName = 'Gets element completions with an incomplete tag';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const incompleteText = `<behav>`;
      editorService.fileChanged(
          indexFile, `${incompleteText}\n${indexContents}`);
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, {line: 0, column: incompleteText.length - 2}),
          elementTypeahead);
    });

    test('get element completions for the end of a tag', async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, tagPositionEnd),
          elementTypeahead);
    });

    testName = 'Get attribute completions when editing an existing attribute';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    testName = 'Get attribute completions when adding a new attribute';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const partialContents = [
        `<behavior-test-elem >`, `<behavior-test-elem existing-attr>`,
        `<behavior-test-elem existing-attr></behavior-test-elem>`,
        `<behavior-test-elem existing-attr></wrong-closing-tag>`
      ];
      for (const partial of partialContents) {
        await editorService.fileChanged(
            indexFile, `${partial}\n${indexContents}`);
        deepEqual(
            await editorService.getTypeaheadCompletionsFor(indexFile, {
              line: 0,
              column: 20 /* after the space after the element name */
            }),
            attributeTypeahead);
      }
    });

    testName = 'Recover from references to undefined files.';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);

      // Load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${indexContents}
           <script src="nonexistant.js"></script>`);

      // We recover after getting a good version of the file.
      await editorService.fileChanged(indexFile);

      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    testName = 'Remain useful in the face of unloadable files.';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);

      // We load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${indexContents}
           <script src="nonexistant.js"></script>`);

      // Harder: can we give typeahead completion when there's errors?'
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    testName = 'Remain useful in the face of syntax errors.';
    test(testName, async function() {
      const goodContents =
          fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      // Load a file with a syntax error
      await invertPromise(editorService.fileChanged(
          path.join(basedir, 'syntax-error.js'),
          'var var var var var var var var “hello”'));

      await editorService.fileChanged(indexFile, `${goodContents}
          <script src="./syntax-error.js"></script>`);
      // Even with a reference to the bad file we can still get completions!
      deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });
  });

  suite('getWarnings', function() {
    test('For a good document we get no warnings', async function() {
      await editorService.fileChanged(indexFile);
      deepEqual(await editorService.getWarningsFor(indexFile), []);
    });

    test(`Warn on imports of files that aren't found.`, async function() {
      const badImport = `<link rel="import" href="./does-not-exist.html">`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      const warnings = await editorService.getWarningsFor(indexFile);
      assert.containSubset(warnings, <Warning[]>[{
                             code: 'could-not-load',
                             severity: Severity.ERROR,
                             sourceRange: {
                               file: 'editor-service/index.html',
                               start: {line: 0, column: 19},
                               end: {line: 0, column: 47}
                             }
                           }]);
      assert.match(
          warnings[0].message,
          /Unable to load import:.*no such file or directory/);
    });

    test(`Warn on imports of files that don't parse.`, async function() {
      const badImport = `<script src="../js-parse-error.js"></script>`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      const warnings = await editorService.getWarningsFor(indexFile);
      assert.containSubset(
          warnings, <Warning[]>[{
            code: 'could-not-load',
            message: 'Unable to load import: Unexpected token ,',
            severity: Severity.ERROR,
            sourceRange: {
              file: 'editor-service/index.html',
              start: {line: 0, column: 8},
              end: {line: 0, column: 34}
            }
          }]);
    });

    let testName = `Don't warn on imports of files with no known parser`;
    test(testName, async function() {
      const badImport = `<script src="./foo.unknown_extension"></script>`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      assert.containSubset(await editorService.getWarningsFor(indexFile), []);
    });

    testName = `Warn on syntax errors in inline javascript documents`;
    test(testName, async function() {
      const badScript = `\n<script>var var var var var let const;</script>`;
      await editorService.fileChanged(indexFile, badScript);
      const warnings = await editorService.getWarningsFor(indexFile);
      assert.containSubset(warnings, <Warning[]>[{
                             code: 'parse-error',
                             severity: Severity.ERROR,
                             message: 'Unexpected token var',
                             sourceRange: {
                               file: 'editor-service/index.html',
                               start: {line: 1, column: 13},
                               end: {line: 1, column: 13}
                             }
                           }]);
    });

    testName = `Do not warn on a sibling import ` +
        `if configured with a package url resolver`;
    test(testName, async function() {
      const testBaseDir = path.join(basedir, 'package-url-resolver');
      editorService = editorFactory(testBaseDir);
      const warnings = await editorService.getWarningsFor('simple-elem.html');
      deepEqual(warnings, []);
    });
  });

  suite('getWarnings', function() {
    test('For a good document we get no warnings', async function() {
      await editorService.fileChanged(indexFile);
      assert.deepEqual(await editorService.getWarningsFor(indexFile), []);
    });

    test(`Warn on imports of files that aren't found.`, async function() {
      const badImport = `<link rel="import" href="./does-not-exist.html">`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      const warnings = await editorService.getWarningsFor(indexFile);
      assert.containSubset(warnings, <Warning[]>[{
                             code: 'could-not-load',
                             severity: Severity.ERROR,
                             sourceRange: {
                               file: 'editor-service/index.html',
                               start: {line: 0, column: 19},
                               end: {line: 0, column: 47}
                             }
                           }]);
      assert.match(
          warnings[0].message,
          /Unable to load import:.*no such file or directory/);
    });

    test(`Warn on imports of files that don't parse.`, async function() {
      const badImport = `<script src="../js-parse-error.js"></script>`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      const warnings = await editorService.getWarningsFor(indexFile);
      assert.containSubset(
          warnings, <Warning[]>[{
            code: 'could-not-load',
            severity: Severity.ERROR,
            message: 'Unable to load import: Unexpected token ,',
            sourceRange: {
              file: 'editor-service/index.html',
              start: {line: 0, column: 8},
              end: {line: 0, column: 34}
            }
          }]);
    });

    let testName = `Don't warn on imports of files with no known parser`;
    test(testName, async function() {
      const badImport = `<script src="./foo.unknown_extension"></script>`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      assert.containSubset(await editorService.getWarningsFor(indexFile), []);
    });
  });
}

/**
 * We need to use different deep equality functions when testing EditorService
 * and RemoteEditorService because RemoteEditorService has gone through a
 * JSON stringify/parse pass.
 */
let deepEqual: (actual: any, expected: any, message?: string) => void;
suite('EditorService', function() {
  suiteSetup(() => {
    deepEqual = assert.deepEqual;
  });
  editorTests((basedir) => new EditorService({
                urlLoader: new FSUrlLoader(basedir),
                urlResolver: new PackageUrlResolver()
              }));
});

// It takes ~300ms to wake up a new RemoteEditorService, so when running tests
// in fast mode we cache them by basedir.
const sloppyTest = !!process.env.QUICK_TESTS;
suite('RemoteEditorService', function() {
  suiteSetup(() => {
    deepEqual = expectJsonDeepEqual;
  });
  const remoteEditorsByBasedir = new Map<string, RemoteEditorService>();
  const editors: RemoteEditorService[] = [];
  editorTests((basedir) => {
    if (sloppyTest) {
      const cachedServer = remoteEditorsByBasedir.get(basedir);
      if (cachedServer) {
        return cachedServer;
      }
    }
    const server = new RemoteEditorService(basedir);
    if (sloppyTest) {
      remoteEditorsByBasedir.set(basedir, server);
    }
    editors.push(server);
    return server;
  });

  teardown(async() => {
    if (sloppyTest) {
      // clear the caches to minimize inter-test interaction.
      for (const server of editors) {
        await server.clearCaches();
      }
      return;
    }

    // tear them all down
    for (const server of editors) {
      server.dispose();
    }
    editors.length = 0;
  });

  suiteTeardown(() => {
    // Final cleanup for sloppy mode.
    if (sloppyTest) {
      for (const server of remoteEditorsByBasedir.values()) {
        server.dispose();
      }
      remoteEditorsByBasedir.clear();
    }
  });
});


function expectJsonDeepEqual(actual: any, expected: any) {
  // Primarily useful because it strips out `undefined`, which
  // RemoteEditorService does because it uses JSON for IPC.
  assert.deepEqual(actual, JSON.parse(JSON.stringify(expected)));
}
