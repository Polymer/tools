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
import * as clone from 'clone';
import {readFileSync} from 'fs';
import * as path from 'path';
import {CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat, MarkupContent} from 'vscode-languageserver/lib/main';

import {standardJavaScriptSnippets} from '../standard-snippets';

import {createTestEnvironment, defaultClientCapabilities} from './util';

const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'static');

const elementCompletions: CompletionItem[] = [
  {
    documentation: {
      kind: 'markdown',
      value: 'An element to test out behavior inheritance.'
    },
    insertText: '<behavior-test-elem $1></behavior-test-elem>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<behavior-test-elem>',
    filterText: 'behaviortestelem',
  },
  {
    documentation: {kind: 'markdown', value: ''},
    insertText: '<class-declaration></class-declaration>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<class-declaration>',
    filterText: 'classdeclaration',
  },
  {
    documentation: {kind: 'markdown', value: ''},
    insertText: '<anonymous-class></anonymous-class>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<anonymous-class>',
    filterText: 'anonymousclass',
  },
  {
    documentation: {kind: 'markdown', value: ''},
    insertText: '<class-expression></class-expression>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<class-expression>',
    filterText: 'classexpression',
  },
  {
    documentation: {kind: 'markdown', value: ''},
    insertText: '<register-before-declaration></register-before-declaration>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<register-before-declaration>',
    filterText: 'registerbeforedeclaration',
  },
  {
    documentation: {kind: 'markdown', value: ''},
    insertText: '<register-before-expression></register-before-expression>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<register-before-expression>',
    filterText: 'registerbeforeexpression',
  },
  {
    documentation: {
      kind: 'markdown',
      value: 'This is a description of WithObservedAttributes.'
    },
    insertText: '<vanilla-with-observed-attributes $1>' +
        '</vanilla-with-observed-attributes>$0',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Class,
    label: '<vanilla-with-observed-attributes>',
    filterText: 'vanillawithobservedattributes',
  },
];

// Like elementCompletions, but without leading `<` characters.
const elementTagnameCompletions = elementCompletions.map(ec => {
  return {...ec, insertText: ec.insertText!.slice(1)};
});

const elementCompletionsWithPlainDescriptions = elementCompletions.map(ec => {
  return {...ec, documentation: (ec.documentation as MarkupContent).value};
});

const attributeCompletions: CompletionItem[] = [
  {
    label: 'local-property',
    documentation: {
      kind: 'markdown',
      value: 'A property defined directly on behavior-test-elem.',
    },
    kind: CompletionItemKind.Field,
    detail: '{boolean | null | undefined}',
    sortText: 'aaa-local-property',
  },
  {
    label: 'non-notifying-property',
    documentation: {kind: 'markdown', value: ''},
    kind: CompletionItemKind.Field,
    detail: '{string | null | undefined}',
    sortText: 'aaa-non-notifying-property',
  },
  {
    label: 'notifying-property',
    documentation: {kind: 'markdown', value: ''},
    kind: CompletionItemKind.Field,
    detail: '{string | null | undefined}',
    sortText: 'aaa-notifying-property',

  },
  {
    label: 'deeply-inherited-property',
    documentation: {
      kind: 'markdown',
      value: 'This is a deeply inherited property.',
    },
    kind: CompletionItemKind.Field,
    detail: '{Array | null | undefined} ⊃ MyNamespace.SubBehavior',
    sortText: 'ddd-deeply-inherited-property',
  },
  {
    label: 'inherit-please',
    documentation: {
      kind: 'markdown',
      value: 'A property provided by SimpleBehavior.',
    },
    kind: CompletionItemKind.Field,
    detail: '{number | null | undefined} ⊃ MyNamespace.SimpleBehavior',
    sortText: 'ddd-inherit-please',
  },
  {
    label: 'on-local-property-changed',
    documentation: {
      kind: 'markdown',
      value: 'Fired when the `localProperty` property changes.'
    },
    kind: CompletionItemKind.Field,
    detail: '{CustomEvent}',
    sortText: 'eee-aaa-on-local-property-changed',
  },
  {
    label: 'on-notifying-property-changed',
    documentation: {
      kind: 'markdown',
      value: 'Fired when the `notifyingProperty` property changes.'
    },
    kind: CompletionItemKind.Field,
    detail: '{CustomEvent}',
    sortText: 'eee-aaa-on-notifying-property-changed',
  },
  {
    label: 'on-deeply-inherited-property-changed',
    documentation: {
      kind: 'markdown',
      value: 'Fired when the `deeplyInheritedProperty` property changes.'
    },
    kind: CompletionItemKind.Field,
    detail: '{CustomEvent} ⊃ MyNamespace.SubBehavior',
    sortText: 'eee-ddd-on-deeply-inherited-property-changed',
  },
  {
    label: 'on-inherit-please-changed',
    documentation: {
      kind: 'markdown',
      value: 'Fired when the `inheritPlease` property changes.'
    },
    kind: CompletionItemKind.Field,
    detail: '{CustomEvent} ⊃ MyNamespace.SimpleBehavior',
    sortText: 'eee-ddd-on-inherit-please-changed',
  },
];

suite('AutoCompleter', () => {
  const indexFile = path.join('editor-service', 'index.html');
  const indexContents = readFileSync(path.join(fixtureDir, indexFile), 'utf-8');
  const tagPosition = {line: 7, column: 9};
  const tagPositionEnd = {line: 7, column: 21};
  const localAttributePosition = {line: 7, column: 31};

  test('Get element completions for an empty text region', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    const completions =
        await client.getCompletions(indexFile, {line: 0, column: 0});
    assert.deepEqual(
        completions, {isIncomplete: false, items: elementCompletions});
    await client.cleanup();
  });

  let testName = `Doesn't send down markdown if the client doesn't support it`;
  test(testName, async() => {
    const capabilities = clone(defaultClientCapabilities);
    capabilities.textDocument!.completion!.completionItem! = {
      ...(capabilities.textDocument!.completion!.completionItem!),
      documentationFormat: undefined
    };

    const {client} = await createTestEnvironment({fixtureDir, capabilities});
    await client.openFile(indexFile);
    const completions =
        await client.getCompletions(indexFile, {line: 0, column: 0});

    assert.deepEqual(
        completions,
        {isIncomplete: false, items: elementCompletionsWithPlainDescriptions});
  });

  test('Get element completions for a start tag', async() => {
    const {client} = await createTestEnvironment({fixtureDir});

    await client.openFile(indexFile);
    const completions = await client.getCompletions(indexFile, tagPosition);
    assert.deepEqual(
        completions, {isIncomplete: false, items: elementTagnameCompletions});
    await client.cleanup();
  });

  test('Gets element completions with an incomplete tag', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    const incompleteText = `<behav>\n${indexContents}`;
    await client.changeFile(indexFile, incompleteText);
    assert.deepEqual(
        await client.getCompletions(
            indexFile, {line: 0, column: incompleteText.length - 2}),
        {isIncomplete: false, items: elementCompletions});
    await client.cleanup();
  });

  test('Get element completions for the end of a tag', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    assert.deepEqual(
        await client.getCompletions(indexFile, tagPositionEnd),
        {isIncomplete: false, items: elementTagnameCompletions});
    await client.cleanup();
  });

  testName = 'Get attribute completions when editing an existing attribute';
  test(testName, async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    assert.deepEqual(
        await client.getCompletions(indexFile, localAttributePosition),
        {isIncomplete: false, items: attributeCompletions});
    await client.cleanup();
  });

  test('Get attribute completions when adding a new attribute', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    const partialContents = [
      `<behavior-test-elem >`, `<behavior-test-elem existing-attr>`,
      `<behavior-test-elem existing-attr></behavior-test-elem>`,
      `<behavior-test-elem existing-attr></wrong-closing-tag>`
    ];
    for (const partial of partialContents) {
      await client.changeFile(indexFile, `${partial}\n${indexContents}`);
      assert.deepEqual(
          await client.getCompletions(indexFile, {
            line: 0,
            column: 20  // after the space after the element
                        // name
          }),
          {isIncomplete: false, items: attributeCompletions});
    }
    await client.cleanup();
  });

  test('Get attribute completions when adding a new attribute', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    const partialContents = [
      `<behavior-test-elem >`, `<behavior-test-elem existing-attr>`,
      `<behavior-test-elem existing-attr></behavior-test-elem>`,
      `<behavior-test-elem existing-attr></wrong-closing-tag>`
    ];
    for (const partial of partialContents) {
      await client.changeFile(indexFile, `${partial}\n${indexContents}`);
      assert.deepEqual(
          await client.getCompletions(indexFile, {
            line: 0,
            column: 20  // after the space after the element
                        // name
          }),
          {isIncomplete: false, items: attributeCompletions});
    }
    await client.cleanup();
  });

  testName = 'Get attribute value completions for non-notifying property';
  test(testName, async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const testFile = path.join('editor-service', 'value-completion.html');
    const testContents = readFileSync(path.join(fixtureDir, testFile), 'utf-8');
    await client.openFile(testFile, testContents);
    assert.deepEqual(
        await client.getCompletions(testFile, {
          line: 4,
          column: 49  // inside the quotes
        }),
        {
          isIncomplete: false,
          items: [
            {
              label: 'bar',
              insertText: '[[bar]]',
              documentation: {kind: 'markdown', value: ''},
              sortText: 'aaa-bar',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
            {
              label: 'foo',
              insertText: '[[foo]]',
              documentation: {kind: 'markdown', value: ''},
              sortText: 'aaa-foo',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
          ],
        });
    // There's an invalid expression in this source file, but that's ok.
    assert.deepEqual(
        (await client.getNextDiagnostics(testFile)).map(d => d.code),
        ['invalid-polymer-expression']);
    await client.cleanup();
  });

  test('Get attribute value completions for notifying property', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const testFile = path.join('editor-service', 'value-completion.html');
    const testContents = readFileSync(path.join(fixtureDir, testFile), 'utf-8');
    await client.openFile(testFile, testContents);
    assert.deepEqual(
        await client.getCompletions(testFile, {
          line: 4,
          column: 71  // after the space after the element name
        }),
        {
          isIncomplete: false,
          items: [
            {
              insertText: '{{bar}}',
              documentation: {kind: 'markdown', value: ''},
              label: 'bar',
              sortText: 'aaa-bar',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
            {
              insertText: '{{foo}}',
              documentation: {kind: 'markdown', value: ''},
              label: 'foo',
              sortText: 'aaa-foo',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
          ],
        });
    // There's an invalid expression in this source file, but that's ok.
    assert.deepEqual(
        (await client.getNextDiagnostics(testFile)).map(d => d.code),
        ['invalid-polymer-expression']);
    await client.cleanup();
  });

  testName =
      'Get attribute value completions for notifying property without brackets';
  test(testName, async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const testFile = path.join('editor-service', 'value-completion.html');
    const testContents = readFileSync(path.join(fixtureDir, testFile), 'utf-8');
    await client.openFile(testFile, testContents);
    assert.deepEqual(
        await client.getCompletions(testFile, {
          line: 4,
          column: 91  // after the space after the element name
        }),
        {
          isIncomplete: false,
          items: [
            {
              insertText: 'bar',
              documentation: {kind: 'markdown', value: ''},
              label: 'bar',
              sortText: 'aaa-bar',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
            {
              insertText: 'foo',
              documentation: {kind: 'markdown', value: ''},
              label: 'foo',
              sortText: 'aaa-foo',
              detail: '{string | null | undefined}',
              kind: CompletionItemKind.Field,
            },
          ],
        });
    // There's an invalid expression in this source file, but that's ok.
    assert.deepEqual(
        (await client.getNextDiagnostics(testFile)).map(d => d.code),
        ['invalid-polymer-expression']);
    await client.cleanup();
  });

  test('Inserts slots in autocompletion snippet', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const slotFile = path.join('editor-service', 'slot.html');
    await client.openFile(
        slotFile, readFileSync(path.join(fixtureDir, slotFile), 'utf-8'));

    assert.deepEqual(
        await client.getCompletions(slotFile, {
          line: 1,
          column: 0  // after the space after the element name
        }),
        {
          isIncomplete: false,
          items: [
            {
              label: '<slot-test-elem>',
              insertText: '<slot-test-elem>\n' +
                  '\t<$\{1:div\} slot="slot1">$2</$\{1:div\}>\n' +
                  '\t<$\{3:div\} slot="slot2">$4</$\{3:div\}>\n' +
                  '\t<$\{5:div\}>$6</$\{5:div\}>\n' +
                  '</slot-test-elem>$0',
              insertTextFormat: InsertTextFormat.Snippet,
              documentation: {kind: 'markdown', value: ''},
              kind: CompletionItemKind.Class,
              filterText: `slottestelem`,
            },
            {
              label: '<slot-one-test-elem>',
              insertText: `<slot-one-test-elem>$1</slot-one-test-elem>$0`,
              insertTextFormat: InsertTextFormat.Snippet,
              documentation: {kind: 'markdown', value: ''},
              kind: CompletionItemKind.Class,
              filterText: `slotonetestelem`,
            }
          ],
        });
    await client.cleanup();
  });

  test('Recover from references to undefined files', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);

    // Load a file that contains a reference error.
    await client.changeFile(indexFile, `${indexContents}
                                     <script src="nonexistant.js"></script>`);

    // We recover after getting a good version of the file.
    await client.changeFile(indexFile, indexContents);

    assert.deepEqual(
        await client.getCompletions(indexFile, localAttributePosition),
        {isIncomplete: false, items: attributeCompletions});
    await client.cleanup();
  });

  test('Remain useful in the face of unloadable files', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile);
    assert.deepEqual(
        (await client.getNextDiagnostics(indexFile)).map(d => d.code), []);

    // We load a file that contains a reference error.
    await client.changeFile(indexFile, `${indexContents}
                                     <script src="nonexistant.js"></script>`);

    // Harder: can we give typeahead completion when there's
    // errors?'
    assert.deepEqual(
        await client.getCompletions(indexFile, localAttributePosition),
        {isIncomplete: false, items: attributeCompletions});

    assert.deepEqual(
        (await client.getNextDiagnostics(indexFile)).map(d => d.code),
        ['could-not-load']);
    await client.cleanup();
  });

  test('Remain useful in the face of syntax errors', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const goodContents =
        readFileSync(path.join(fixtureDir, indexFile), 'utf-8');
    // Load a file with a syntax error
    await client.openFile(
        'syntax-error.js', 'var var var var var var var var “hello”');

    await client.openFile(indexFile, `${goodContents}
                                    <script src="./syntax-error.js"></script>`);
    // Even with a reference to the bad file we can still
    // get completions!
    assert.deepEqual(
        await client.getCompletions(indexFile, localAttributePosition),
        {isIncomplete: false, items: attributeCompletions});

    // Consume diagnostics that are reported.
    assert.deepEqual(
        (await client.getNextDiagnostics(indexFile)).map(d => d.code),
        ['could-not-load']);
    // We get this one twice, once when the file is opened, and again when
    // indexFile is modified.
    assert.deepEqual(
        (await client.getNextDiagnostics('syntax-error.js')).map(d => d.code),
        ['parse-error']);
    assert.deepEqual(
        (await client.getNextDiagnostics('syntax-error.js')).map(d => d.code),
        ['parse-error']);
    await client.cleanup();
  });

  testName = `Return JavaScript standard completions inside of script tags`;
  test(testName, async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexFile, '<script>\n\n</script>\n' + indexContents);
    const completions =
        await client.getCompletions(indexFile, {line: 1, column: 0});
    assert.deepEqual(
        completions, {isIncomplete: false, items: standardJavaScriptSnippets});
  });

  {
    const fooPropUsePosition = {line: 2, column: 16};
    const internalPropUsePosition = {line: 3, column: 12};

    const databindingCompletions: CompletionList = {
      isIncomplete: false,
      items: [
        {
          documentation: {kind: 'markdown', value: 'A private internal prop.'},
          label: '_internal',
          sortText: 'aaa-_internal',
          detail: '{string | null | undefined}',
          kind: CompletionItemKind.Field
        },
        {
          documentation: {kind: 'markdown', value: 'This is the foo property.'},
          label: 'foo',
          sortText: 'aaa-foo',
          detail: '{string | null | undefined}',
          kind: CompletionItemKind.Field
        },
      ]
    };
    test('Give autocompletions for positions in databindings', async() => {
      const {client} = await createTestEnvironment({fixtureDir});
      assert.deepEqual(
          await client.getCompletions(
              'polymer/element-with-databinding.html', fooPropUsePosition),
          databindingCompletions);
      assert.deepEqual(
          await client.getCompletions(
              'polymer/element-with-databinding.html', internalPropUsePosition),
          databindingCompletions);
      await client.cleanup();
    });


    const customPropertyExample = `
      <style>
        div {
          --foo: red;
          --bar: var(--baz);
          --fizz: {--floo: var(--flub);};
        }
      </style>
    `;
    const declaractionPosition = {line: 3, column: 16};
    const usePosition = {line: 4, column: 27};

    test(`autocomplete css custom property declarations`, async() => {
      const {client} = await createTestEnvironment();
      await client.openFile('index.html', customPropertyExample);
      assert.deepEqual(
          await client.getCompletions('index.html', declaractionPosition), {
            isIncomplete: false,
            items: [
              {label: '--bar', kind: CompletionItemKind.Variable},
              {label: '--baz', kind: CompletionItemKind.Variable},
              {label: '--fizz', kind: CompletionItemKind.Variable},
              {label: '--floo', kind: CompletionItemKind.Variable},
              {label: '--flub', kind: CompletionItemKind.Variable},
            ]
          });
      await client.cleanup();
    });

    test(`autocomplete css custom property uses`, async() => {
      const {client} = await createTestEnvironment();
      await client.openFile('index.html', customPropertyExample);
      assert.deepEqual(await client.getCompletions('index.html', usePosition), {
        isIncomplete: false,
        items: [
          {label: '--bar', kind: CompletionItemKind.Variable},
          {label: '--fizz', kind: CompletionItemKind.Variable},
          {label: '--floo', kind: CompletionItemKind.Variable},
          {label: '--foo', kind: CompletionItemKind.Variable},
        ]
      });
      await client.cleanup();
    });
  }

  test(`Complete slot names`, async() => {
    const {client} = await createTestEnvironment();
    await client.openFile('index.html', `
      <my-elem>
        <div slot=""></div>
      </my-elem>

      <dom-module id="my-elem">
        <template>
          <slot name="foo"></slot>
          <slot name="bar"></slot>
          <slot></slot>
        </template>
        <script>customElements.define('my-elem', class extends HTMLElement{});
        </script>
      </dom-module>
    `);
    `2,19`;
    assert.deepEqual(
        await client.getCompletions('index.html', {column: 19, line: 2}), {
          isIncomplete: false,
          items: [
            {kind: CompletionItemKind.Variable, label: 'foo'},
            {kind: CompletionItemKind.Variable, label: 'bar'}
          ]
        });
    await client.cleanup();
  });
});
