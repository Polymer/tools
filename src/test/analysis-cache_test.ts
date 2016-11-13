/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import {AnalysisCache, getImportersOf} from '../analysis-cache';
import {Analyzer} from '../analyzer';
import {FSUrlLoader} from '../url-loader/fs-url-loader';

suite('AnalysisCache', () => {
  test('it can be constructed', () => {
    new AnalysisCache();
  });

  function addFakeDocumentToCache(cache: AnalysisCache, path: string) {
    cache.parsedDocumentPromises.set(
        path, Promise.resolve(`parsed ${path} promise` as any));
    cache.scannedDocumentPromises.set(
        path, Promise.resolve(`scanned ${path} promise` as any));
    cache.analyzedDocumentPromises.set(
        path, Promise.resolve(`analyzed ${path} promise` as any));
    cache.dependenciesScanned.set(path, Promise.resolve());
    cache.scannedDocuments.set(path, `scanned ${path}` as any);
    cache.analyzedDocuments.set(path, `analyzed ${path}` as any);
  }

  async function assertHasDocument(cache: AnalysisCache, path: string) {
    assert.equal(
        await cache.parsedDocumentPromises.get(path), `parsed ${path} promise`);
    assert.equal(
        await cache.scannedDocumentPromises.get(path),
        `scanned ${path} promise`);
    assert.equal(await cache.dependenciesScanned.get(path), undefined);
    // caller must assert on cache.analyzedDocumentPromises themselves
    assert.equal(cache.scannedDocuments.get(path), `scanned ${path}`);
    assert.equal(cache.analyzedDocuments.get(path), `analyzed ${path}`);
  }

  function assertNotHasDocument(cache: AnalysisCache, path: string) {
    assert.isFalse(cache.parsedDocumentPromises.has(path));
    assert.isFalse(cache.scannedDocumentPromises.has(path));
    assert.isFalse(cache.dependenciesScanned.has(path));
    // caller must assert on cache.analyzedDocumentPromises themselves
    assert.isFalse(cache.scannedDocuments.has(path));
    assert.isFalse(cache.analyzedDocuments.has(path));
  }

  async function assertDocumentScannedButNotResolved(
      cache: AnalysisCache, path: string) {
    assert.equal(
        await cache.parsedDocumentPromises.get(path), `parsed ${path} promise`);
    assert.equal(
        await cache.scannedDocumentPromises.get(path),
        `scanned ${path} promise`);
    assert.equal(cache.scannedDocuments.get(path), `scanned ${path}`);
    assert.isFalse(cache.analyzedDocuments.has(path));
    assert.isFalse(cache.analyzedDocumentPromises.has(path));
    assert.isFalse(cache.dependenciesScanned.has(path));
  }

  test('it invalidates a path when asked to', async() => {
    const cache = new AnalysisCache();
    addFakeDocumentToCache(cache, 'index.html');
    addFakeDocumentToCache(cache, 'unrelated.html');
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');

    const forkedCache = cache.onPathChanged('index.html', []);
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');
    assertNotHasDocument(forkedCache, 'index.html');
    await assertHasDocument(forkedCache, 'unrelated.html');

    // The promise of unrelated.html's result has been turned into
    // a Promise.resolve() of its non-promise cache.
    assert.equal(
        await forkedCache.analyzedDocumentPromises.get('unrelated.html'),
        `analyzed unrelated.html`);
  });

  test('it invalidates the dependants of a path when asked to', async() => {
    const cache = new AnalysisCache();
    // Picture a graph where
    addFakeDocumentToCache(cache, 'index.html');
    addFakeDocumentToCache(cache, 'element.html');
    addFakeDocumentToCache(cache, 'behavior.html');
    addFakeDocumentToCache(cache, 'unrelated.html');
    // We added the documents.
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');
    await assertHasDocument(cache, 'behavior.html');
    await assertHasDocument(cache, 'unrelated.html');

    const forkedCache =
        cache.onPathChanged('behavior.html', ['index.html', 'element.html']);
    // The original cache is untouched.
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');
    await assertHasDocument(cache, 'behavior.html');
    await assertHasDocument(cache, 'unrelated.html');

    // The fork has no trace of behavior.html, and its dependants are scanned
    // but not resolved. Unrelated documents are still fully cached.
    assertNotHasDocument(forkedCache, 'behavior.html');
    await assertDocumentScannedButNotResolved(forkedCache, 'index.html');
    await assertDocumentScannedButNotResolved(forkedCache, 'element.html');
    await assertHasDocument(forkedCache, 'unrelated.html');
  });
});

suite('getImportersOf', () => {
  let analyzer: Analyzer;
  setup(() => {
    analyzer = new Analyzer(
        {urlLoader: new FSUrlLoader(path.join(__dirname, 'static'))});
  });

  async function assertImportersOf(path: string, expectedDependants: string[]) {
    await analyzer.analyze(path);
    const docs = Array.from(
        analyzer['_cacheContext']['_cache']['analyzedDocuments'].values());
    const scannedDocs = docs.map(d => d['_scannedDocument']);

    const urlResolver = (url: string) => url;
    expectedDependants.sort();
    assert.deepEqual(
        Array.from(getImportersOf(path, docs, scannedDocs, urlResolver)).sort(),
        expectedDependants,
        'with both docs and scanned docs');
    // Also works with no documents, just scanned documents.
    assert.deepEqual(
        Array.from(getImportersOf(path, [], scannedDocs, urlResolver)).sort(),
        expectedDependants,
        'with just scanned docs');
  }

  test('it works with a basic document with no dependencies', async() => {
    await assertImportersOf(
        'dependencies/leaf.html', ['dependencies/leaf.html']);
  });

  test('it works with a simple tree of dependencies', async() => {
    await analyzer.analyze('dependencies/root.html');
    await assertImportersOf(
        'dependencies/root.html', ['dependencies/root.html']);

    await assertImportersOf(
        'dependencies/leaf.html',
        ['dependencies/leaf.html', 'dependencies/root.html']);
    await assertImportersOf('dependencies/subfolder/subfolder-sibling.html', [
      'dependencies/subfolder/subfolder-sibling.html',
      'dependencies/subfolder/in-folder.html',
      'dependencies/inline-and-imports.html',
      'dependencies/root.html'
    ]);
  });
});
