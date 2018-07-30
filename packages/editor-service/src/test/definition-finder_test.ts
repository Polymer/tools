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
import {writeFileSync} from 'fs';
import * as path from 'path';

import {DocumentSymbol} from 'vscode-languageserver';
import {createTestEnvironment} from './util';

const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'static');

// TODO(https://github.com/Polymer/tools/issues/170): these tests are slightly
//     flaky, skip for now.
suite.skip('DefinitionFinder', function() {
  const indexFile = path.join('editor-service', 'index.html');
  const tagPosition = {line: 7, column: 9};
  const localAttributePosition = {line: 7, column: 31};
  const deepAttributePosition = {line: 7, column: 49};

  let testName = `it supports getting the definition of ` +
      `an element from its tag`;
  test(testName, async() => {
    const {client, underliner} = await createTestEnvironment({fixtureDir});
    assert.deepEqual(
        await underliner.underline(
            await client.getDefinition(indexFile, tagPosition)),
        [`
  Polymer({
          ~
    is: 'behavior-test-elem',
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    behaviors: [MyNamespace.SimpleBehavior],
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    properties: {
~~~~~~~~~~~~~~~~~
      /** A property defined directly on behavior-test-elem. */
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      localProperty: {
~~~~~~~~~~~~~~~~~~~~~~
        type: Boolean,
~~~~~~~~~~~~~~~~~~~~~~
        value: true,
~~~~~~~~~~~~~~~~~~~~
        notify: true
~~~~~~~~~~~~~~~~~~~~
      },
~~~~~~~~
      nonNotifyingProperty: {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        type: String
~~~~~~~~~~~~~~~~~~~~
      },
~~~~~~~~
      notifyingProperty: {
~~~~~~~~~~~~~~~~~~~~~~~~~~
        type: String,
~~~~~~~~~~~~~~~~~~~~~
        notify: true
~~~~~~~~~~~~~~~~~~~~
      },
~~~~~~~~
      /** This is used entirely for internal purposes ok. */
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      _privateProperty: {
~~~~~~~~~~~~~~~~~~~~~~~~~
        type: String,
~~~~~~~~~~~~~~~~~~~~~
        value: 'don\\'t look!'
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      }
~~~~~~~
    },
~~~~~~


    created: function() {
~~~~~~~~~~~~~~~~~~~~~~~~~
      console.log('created!');
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    }
~~~~~
  });
~~~`]);
    await client.cleanup();
  });


  test('it supports getting the definition of a local attribute', async() => {
    const {client, underliner} = await createTestEnvironment({fixtureDir});
    assert.deepEqual(
        await underliner.underline(
            await client.getDefinition(indexFile, localAttributePosition)),
        [`
      localProperty: {
      ~~~~~~~~~~~~~~~~
        type: Boolean,
~~~~~~~~~~~~~~~~~~~~~~
        value: true,
~~~~~~~~~~~~~~~~~~~~
        notify: true
~~~~~~~~~~~~~~~~~~~~
      },
~~~~~~~`]);
    await client.cleanup();
  });

  testName = 'it supports getting the definition of an attribute ' +
      'defined in a behavior';
  test(testName, async() => {
    const {client, underliner} = await createTestEnvironment({fixtureDir});

    assert.deepEqual(
        await underliner.underline(
            await client.getDefinition(indexFile, deepAttributePosition)),
        [`
      deeplyInheritedProperty: {
      ~~~~~~~~~~~~~~~~~~~~~~~~~~
        type: Array,
~~~~~~~~~~~~~~~~~~~~
        value: function() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~
          return [];
~~~~~~~~~~~~~~~~~~~~
        },
~~~~~~~~~~
        notify: true
~~~~~~~~~~~~~~~~~~~~
      }
~~~~~~~`]);
    await client.cleanup();
  });

  test('it supports properties in databindings.', async() => {
    const fooPropUsePosition = {line: 2, column: 16};
    const internalPropUsePosition = {line: 3, column: 12};
    const {client, underliner} = await createTestEnvironment({fixtureDir});

    let location = (await client.getDefinition(
        'polymer/element-with-databinding.html', fooPropUsePosition))!;

    assert.deepEqual(await underliner.underline(location), [`
        foo: String,
        ~~~~~~~~~~~`]);
    location = (await client.getDefinition(
        'polymer/element-with-databinding.html', internalPropUsePosition))!;
    assert.deepEqual(await underliner.underline(location), [`
        _internal: String,
        ~~~~~~~~~~~~~~~~~`]);
    await client.cleanup();
  });


  testName = `it supports getting references to an element from its tag`;
  test(testName, async() => {
    const contentsPath = path.join('editor-service', 'references.html');
    const {client, underliner} = await createTestEnvironment({fixtureDir});
    await client.openFile(contentsPath);

    let references =
        await client.getReferences(contentsPath, {line: 7, column: 3});
    let ranges = await underliner.underline(references);
    assert.deepEqual(ranges, [
      `
  <anonymous-class one></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
  <anonymous-class two></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
    ]);

    references =
        await client.getReferences(contentsPath, {line: 7, column: 3}, true);
    ranges = await underliner.underline(references);
    assert.deepEqual(ranges, [
      `
customElements.define('anonymous-class', class extends HTMLElement{});
                                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
  <anonymous-class one></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
  <anonymous-class two></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
    ]);

    references = await client.getReferences(contentsPath, {line: 8, column: 3});
    ranges = await underliner.underline(references);

    assert.deepEqual(ranges, [
      `
  <simple-element one></simple-element>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
    <simple-element two></simple-element>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
    ]);
    await client.cleanup();
  });

  test(`supports getting workspace symbols`, async() => {
    const {client} = await createTestEnvironment(
        {fixtureDir: path.join(fixtureDir, 'editor-service')});
    assert.deepEqual(
        (await client.getWorkspaceSymbols(''))!.map((s) => s.name), [
          'slot-test-elem',
          'slot-one-test-elem',
          'behavior-user',
        ]);
    assert.deepEqual(
        (await client.getWorkspaceSymbols('one'))!.map((s) => s.name), [
          'slot-one-test-elem',
        ]);
    await client.cleanup();
  });

  test(`supports getting document symbols`, async() => {
    const {client} = await createTestEnvironment(
        {fixtureDir: path.join(fixtureDir, 'editor-service')});
    assert.deepEqual(
        (await client.getDocumentSymbols('slot-test-elem.html') as
             DocumentSymbol[])!.map((s: DocumentSymbol) => s.name),
        [
          'slot-test-elem',
          'slot-one-test-elem',
        ]);
    assert.deepEqual(
        (await client.getWorkspaceSymbols('slot.html'))!.map((s) => s.name),
        []);
    await client.cleanup();
  });

  testName =
      `it supports finding definitions and references of a css custom property`;
  test(testName, async() => {
    const {client, underliner} = await createTestEnvironment(
        {fixtureDir: path.join(fixtureDir, 'css-custom-properties')});
    const locations =
        await client.getDefinition('main.html', {line: 5, column: 20});
    assert.deepEqual(await underliner.underline(locations), [
      `
    --shiny: green;
    ~~~~~~~`,
      `
    --shiny: gold;
    ~~~~~~~`
    ]);

    assert.deepEqual(
        await underliner.underline(
            await client.getReferences('main.html', {line: 5, column: 20})),
        [
          `
    color: var(--shiny);
               ~~~~~~~`,
          `
    @apply --shiny;
           ~~~~~~~`
        ]);
    await client.cleanup();
  });

  testName = `it supports getting code lenses of custom property declarations`;
  test(testName, async() => {
    const {client} = await createTestEnvironment(
        {fixtureDir: path.join(fixtureDir, 'css-custom-properties')});

    await client.changeConfiguration({referencesCodeLens: false});

    assert.deepEqual(
        (await client.getCodeLenses('lib.html'))!.map((c) => c.command!.title),
        []);

    await client.changeConfiguration({referencesCodeLens: true});

    assert.deepEqual(
        (await client.getCodeLenses('lib.html'))!.map((c) => c.command!.title),
        [`Read 2 places.`, `Read 1 place.`, `Read 2 places.`]);
    await client.cleanup();
  });

  test(`it supports getting code lenses of elements`, async() => {
    const {client, baseDir} = await createTestEnvironment();
    // TODO(rictic): this test should work with entirely in-memory contents,
    //     but we need to mess with InMemoryOverlayUrlLoader's listDirectory
    //     method to be sure it includes entirely in-memory files.

    writeFileSync(path.join(baseDir, 'index.html'), `
      <script>
        customElements.define('foo-bar', class extends HTMLElement{});
      </script>
      <foo-bar><foo-bar></foo-bar></foo-bar>

      <foo-bar><baz-bonk></baz-bonk></foo-bar>
      <script>
        customElements.define('baz-bonk', class extends HTMLElement{});
      </script>
    `);

    await client.changeConfiguration({referencesCodeLens: false});

    assert.deepEqual(
        (await client.getCodeLenses('index.html'))!.map(
            (c) => c.command!.title),
        []);

    await client.changeConfiguration({referencesCodeLens: true});

    assert.deepEqual(
        (await client.getCodeLenses('index.html'))!.map(
            (c) => c.command!.title),
        [`Referenced 3 places in HTML.`, `Referenced 1 place in HTML.`]);
    await client.cleanup();
  });
});
