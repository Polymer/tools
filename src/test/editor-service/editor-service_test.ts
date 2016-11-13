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

import {Analyzer} from '../../analyzer';
import {AttributesCompletion, EditorService, ElementCompletion} from '../../editor-service/editor-service';
import {LocalEditorService} from '../../editor-service/local-editor-service';
import {RemoteEditorService} from '../../editor-service/remote-editor-service';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {Severity, Warning} from '../../warning/warning';
import {WarningPrinter} from '../../warning/warning-printer';
import {invertPromise} from '../test-utils';

function editorTests(editorFactory: (basedir: string) => EditorService) {
  const basedir = path.join(__dirname, '../static');
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
  let editorService: EditorService = <EditorService><any>null;
  setup(async() => {
    editorService = editorFactory(basedir);
  });

  suite('getDocumentationAtPosition', function() {
    const tagDescription = 'An element to test out behavior inheritance.';
    const localAttributeDescription =
        '{boolean} A property defined directly on behavior-test-elem.';
    const deepAttributeDescription =
        '{Array} This is a deeply inherited property.';

    test(
        'it supports getting the element description ' +
            'when asking for docs at its tag name',
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          assert.equal(
              await editorService.getDocumentationAtPosition(
                  indexFile, tagPosition),
              tagDescription);
        });

    test(
        'it can still get element info after changing a file in memory',
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          const contents =
              fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
          // Add a newline at the beginning of the file, shifting the lines
          // down.
          await editorService.fileChanged(indexFile, `\n${contents}`);

          assert.equal(
              await editorService.getDocumentationAtPosition(
                  indexFile, tagPosition),
              undefined);
          assert.equal(
              await editorService.getDocumentationAtPosition(
                  indexFile,
                  {line: tagPosition.line + 1, column: tagPosition.column}),
              tagDescription, );
        });

    test('it supports getting an attribute description', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      assert.equal(
          await editorService.getDocumentationAtPosition(
              indexFile, localAttributePosition),
          localAttributeDescription);
    });

    test(
        'it supports getting a description of an attribute ' +
            'defined in a behavior',
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          assert.equal(
              await editorService.getDocumentationAtPosition(
                  indexFile, deepAttributePosition),
              deepAttributeDescription);
        });
  });

  suite('getDefinitionForFeatureAtPosition', function() {

    test(
        `it supports getting the definition of ` +
            `an element from its tag`,
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          deepEqual(
              await editorService.getDefinitionForFeatureAtPosition(
                  indexFile, tagPosition),
              {
                file: 'analysis/behaviors/elementdir/element.html',
                start: {line: 4, column: 10},
                end: {line: 24, column: 3}
              });
        });

    test('it supports getting the definition of a local attribute', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      deepEqual(
          await editorService.getDefinitionForFeatureAtPosition(
              indexFile, localAttributePosition),
          {
            file: 'analysis/behaviors/elementdir/element.html',
            start: {line: 9, column: 6},
            end: {line: 13, column: 7}
          });
    });

    test(
        'it supports getting the definition of an attribute ' +
            'defined in a behavior',
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          deepEqual(
              await editorService.getDefinitionForFeatureAtPosition(
                  indexFile, deepAttributePosition),
              {
                file: 'analysis/behaviors/subdir/subbehavior.html',
                start: {line: 5, column: 6},
                end: {line: 11, column: 7}
              });
        });

  });

  suite('getTypeaheadCompletionsAtPosition', function() {

    test('Get element completions for an empty text region.', async() => {
      await editorService.fileChanged(indexFile, `\n${indexContents}`);
      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, {line: 0, column: 0}),
          emptyStartElementTypeahead);
    });

    test('Get element completions for a start tag.', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, tagPosition),
          elementTypeahead);
    });

    test('Gets element completions with an incomplete tag', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      const incompleteText = `<behav>`;
      editorService.fileChanged(
          indexFile, `${incompleteText}\n${indexContents}`);
      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, {line: 0, column: incompleteText.length - 2}),
          elementTypeahead);
    });

    test('Get element completions for the end of a tag', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, tagPositionEnd),
          elementTypeahead);
    });

    test(
        'Get attribute completions when editing an existing attribute',
        async() => {
          await editorService.fileChanged(indexFile, indexContents);
          deepEqual(
              await editorService.getTypeaheadCompletionsAtPosition(
                  indexFile, localAttributePosition),
              attributeTypeahead);
        });

    test('Get attribute completions when adding a new attribute', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      const partialContents = [
        `<behavior-test-elem >`,
        `<behavior-test-elem existing-attr>`,
        `<behavior-test-elem existing-attr></behavior-test-elem>`,
        `<behavior-test-elem existing-attr></wrong-closing-tag>`
      ];
      for (const partial of partialContents) {
        await editorService.fileChanged(
            indexFile, `${partial}\n${indexContents}`);
        deepEqual(
            await editorService.getTypeaheadCompletionsAtPosition(indexFile, {
              line: 0,
              column: 20 /* after the space after the element name */
            }),
            attributeTypeahead);
      }
    });

    test('Recover from references to undefined files.', async() => {
      await editorService.fileChanged(indexFile, indexContents);

      // Load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${indexContents}
           <script src="nonexistant.js"></script>`);

      // We recover after getting a good version of the file.
      await editorService.fileChanged(indexFile, indexContents);

      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    test('Remain useful in the face of unloadable files.', async() => {
      await editorService.fileChanged(indexFile, indexContents);

      // We load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${indexContents}
           <script src="nonexistant.js"></script>`);

      // Harder: can we give typeahead completion when there's errors?'
      deepEqual(
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    test('Remain useful in the face of syntax errors.', async() => {
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
          await editorService.getTypeaheadCompletionsAtPosition(
              indexFile, localAttributePosition),
          attributeTypeahead);
    });

    test(`Don't give HTML completions inside of script tags.`, async() => {
      await editorService.fileChanged(
          indexFile, '<script>\n\n</script>\n' + indexContents);
      const completions = await editorService.getTypeaheadCompletionsAtPosition(
          indexFile, {line: 1, column: 0});
      assert.deepEqual(completions, undefined);
    });

  });

  suite('getWarningsForFile', function() {
    let fileContents = '';
    const loader = {
      canLoad: () => true,
      load: () => Promise.resolve(fileContents)
    };
    const warningPrinter = new WarningPrinter(
        null as any, {analyzer: new Analyzer({urlLoader: loader})});

    async function getUnderlinedText(warning: Warning) {
      return '\n' + await warningPrinter.getUnderlinedText(warning.sourceRange);
    }

    test('For a good document we get no warnings', async() => {
      await editorService.fileChanged(indexFile, indexContents);
      deepEqual(await editorService.getWarningsForFile(indexFile), []);
    });

    test(`Warn on imports of files that aren't found.`, async() => {
      const badImport = `<link rel="import" href="./does-not-exist.html">`;
      fileContents = `${badImport}\n\n${indexContents}`;
      await editorService.fileChanged(indexFile, fileContents);
      const warnings = await editorService.getWarningsForFile(indexFile);
      assert.equal(
          warnings.filter((warning) => warning.code === 'could-not-load')
              .length,
          1);
      assert.containSubset(
          warnings, [{code: 'could-not-load', severity: Severity.ERROR}]);
      assert.deepEqual(await getUnderlinedText(warnings[0]), `
<link rel="import" href="./does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~`);
      assert.match(
          warnings[0].message,
          /Unable to load import:.*no such file or directory/);
    });

    test(`Warn on imports of files that don't parse.`, async() => {
      const badImport = `<script src="../js-parse-error.js"></script>`;
      fileContents = `${badImport}\n\n${indexContents}`;
      await editorService.fileChanged(indexFile, fileContents);
      const warnings = await editorService.getWarningsForFile(indexFile);
      assert.containSubset(
          warnings, <Warning[]>[{
            code: 'could-not-load',
            message: 'Unable to load import: Unexpected token ,',
            severity: Severity.ERROR,
            sourceRange: {
              file: 'editor-service/index.html',
            }
          }]);
      assert.deepEqual(await getUnderlinedText(warnings[0]), `
<script src="../js-parse-error.js"></script>
            ~~~~~~~~~~~~~~~~~~~~~~`);
    });

    test(`Don't warn on imports of files with no known parser`, async() => {
      const badImport = `<script src="./foo.unknown_extension"></script>`;
      await editorService.fileChanged(
          indexFile, `${badImport}\n\n${indexContents}`);
      assert.containSubset(
          await editorService.getWarningsForFile(indexFile), []);
    });

    test(`Warn on syntax errors in inline javascript documents`, async() => {
      const badScript = `\n<script>var var var var var let const;</script>`;
      fileContents = badScript;
      await editorService.fileChanged(indexFile, fileContents);
      const warnings = await editorService.getWarningsForFile(indexFile);
      assert.containSubset(
          warnings, <Warning[]>[{
            code: 'parse-error',
            severity: Severity.ERROR,
            message: 'Unexpected token var',
            sourceRange: {file: 'editor-service/index.html'}
          }]);
      assert.deepEqual(await getUnderlinedText(warnings[0]), `
<script>var var var var var let const;</script>
             ~`);
    });

    test(
        `Do not warn on a sibling import ` +
            `if configured with a package url resolver`,
        async() => {
          const testBaseDir = path.join(basedir, 'package-url-resolver');
          editorService = editorFactory(testBaseDir);
          const warnings =
              await editorService.getWarningsForFile('simple-elem.html');
          deepEqual(warnings, []);
        });

    test(
        `Warn about parse errors in the file ` +
            `we're requesting errors for.`,
        async() => {
          const warnings =
              await editorService.getWarningsForFile('js-parse-error.js');
          deepEqual(warnings, [{
                      code: 'parse-error',
                      message: 'Unexpected token ,',
                      severity: Severity.ERROR,
                      sourceRange: {
                        file: 'js-parse-error.js',
                        start: {line: 17, column: 8},
                        end: {line: 17, column: 8}
                      }
                    }]);
        });
  });
}

/**
 * We need to use different deep equality functions when testing
 * LocalEditorService and RemoteEditorService because RemoteEditorService has
 * gone through a JSON stringify/parse pass.
 */
let deepEqual: (actual: any, expected: any, message?: string) => void;

suite('LocalEditorService', function() {
  suiteSetup(() => {
    deepEqual = assert.deepEqual;
  });

  editorTests((basedir) => new LocalEditorService({
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
        await server._clearCaches();
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
