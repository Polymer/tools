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

import {Analyzer} from '../../core/analyzer';
import {ScannedNamespace} from '../../javascript/namespace';
import {NamespaceScanner} from '../../javascript/namespace-scanner';
import {CodeUnderliner, fixtureDir, runScanner} from '../test-utils';

suite('NamespaceScanner', () => {
  const testFilesDir = path.resolve(fixtureDir, 'namespaces/');
  const analyzer = Analyzer.createForDirectory(testFilesDir);
  const underliner = new CodeUnderliner(analyzer);

  async function getNamespaces(filename: string) {
    const {features} =
        await runScanner(analyzer, new NamespaceScanner(), filename);
    const scannedNamespaces = [];
    for (const feature of features) {
      if (feature instanceof ScannedNamespace) {
        scannedNamespaces.push(feature);
      }
    }
    return scannedNamespaces;
  };

  test('scans named namespaces', async () => {
    const namespaces = await getNamespaces('namespace-named.js');
    assert.equal(namespaces.length, 2);

    assert.equal(namespaces[0].name, 'ExplicitlyNamedNamespace');
    assert.equal(namespaces[0].description, '');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
var ExplicitlyNamedNamespace = {};
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    assert.equal(
        namespaces[1].name, 'ExplicitlyNamedNamespace.NestedNamespace');
    assert.equal(namespaces[1].description, '');
    assert.deepEqual(namespaces[1].warnings, []);
    assert.equal(await underliner.underline(namespaces[1].sourceRange), `
ExplicitlyNamedNamespace.NestedNamespace = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);
  });

  test('scans unnamed namespaces', async () => {
    const namespaces = await getNamespaces('namespace-unnamed.js');
    assert.equal(namespaces.length, 4);

    assert.equal(namespaces[0].name, 'ImplicitlyNamedNamespace');
    assert.equal(namespaces[0].description, 'A namespace description');
    assert.equal(namespaces[0].summary, 'A namespace summary');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
var ImplicitlyNamedNamespace = {};
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    assert.equal(
        namespaces[1].name, 'ImplicitlyNamedNamespace.NestedNamespace');
    assert.equal(namespaces[1].description, '');
    assert.deepEqual(namespaces[1].warnings, []);
    assert.equal(await underliner.underline(namespaces[1].sourceRange), `
ImplicitlyNamedNamespace.NestedNamespace = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);

    assert.equal(namespaces[2].name, 'ParentNamespace.FooNamespace');
    assert.equal(namespaces[2].description, '');
    assert.deepEqual(namespaces[2].warnings, []);
    assert.equal(await underliner.underline(namespaces[2].sourceRange), `
FooNamespace = {
~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);

    assert.equal(namespaces[3].name, 'ParentNamespace.BarNamespace');
    assert.equal(namespaces[3].description, '');
    assert.deepEqual(namespaces[3].warnings, []);
    assert.equal(await underliner.underline(namespaces[3].sourceRange), `
ParentNamespace.BarNamespace = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);
  });

  test('scans named, dynamic namespaces', async () => {
    const namespaces = await getNamespaces('namespace-dynamic-named.js');
    assert.equal(namespaces.length, 3);

    assert.equal(namespaces[0].name, 'DynamicNamespace.ComputedProperty');
    assert.equal(namespaces[0].description, '');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
DynamicNamespace['ComputedProperty'] = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`);

    assert.equal(
        namespaces[1].name, 'DynamicNamespace.UnanalyzableComputedProperty');
    assert.equal(namespaces[1].description, '');
    assert.deepEqual(namespaces[1].warnings, []);
    assert.equal(await underliner.underline(namespaces[1].sourceRange), `
DynamicNamespace[baz] = {
~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`);

    assert.equal(namespaces[2].name, 'DynamicNamespace.Aliased');
    assert.equal(namespaces[2].description, '');
    assert.deepEqual(namespaces[2].warnings, []);
    assert.equal(await underliner.underline(namespaces[2].sourceRange), `
aliasToNamespace = {
~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`);
  });

  test('scans unnamed, dynamic namespaces', async () => {
    const namespaces = await getNamespaces('namespace-dynamic-unnamed.js');
    assert.equal(namespaces.length, 1);

    assert.equal(
        namespaces[0].name, 'DynamicNamespace.InferredComputedProperty');
    assert.equal(namespaces[0].description, '');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
DynamicNamespace['InferredComputedProperty'] = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`);
  });
});
