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

import {AnalysisCache} from '../../core/analysis-cache';
import {ResolvedUrl} from '../../model/url';

suite('AnalysisCache', () => {
  test('it can be constructed', () => {
    new AnalysisCache();
  });

  function addFakeDocumentToCache(
      cache: AnalysisCache, path: string, dependencies: string[]) {
    const resolvedPath = path as ResolvedUrl;
    const resolvedDependencies = dependencies as ResolvedUrl[];
    cache.parsedDocumentPromises.set(
        resolvedPath, `parsed ${resolvedPath} promise` as any);
    cache.scannedDocumentPromises.set(
        resolvedPath, `scanned ${resolvedPath} promise` as any);
    cache.analyzedDocumentPromises.set(
        resolvedPath, `analyzed ${resolvedPath} promise` as any);
    cache.scannedDocuments.set(resolvedPath, `scanned ${resolvedPath}` as any);
    cache.analyzedDocuments.set(
        resolvedPath, `analyzed ${resolvedPath}` as any);
    cache.dependencyGraph.addDocument(resolvedPath, resolvedDependencies);
  }

  async function assertHasDocument(cache: AnalysisCache, path: string) {
    const resolvedPath = path as ResolvedUrl;
    assert.equal(
        await cache.parsedDocumentPromises.getOrCompute(
            resolvedPath, null as any) as any,
        `parsed ${resolvedPath} promise`);
    assert.equal(
        await cache.scannedDocumentPromises.getOrCompute(
            resolvedPath, null as any) as any,
        `scanned ${resolvedPath} promise`);
    // caller must assert on cache.analyzedDocumentPromises themselves
    assert.equal(
        cache.scannedDocuments.get(resolvedPath) as any,
        `scanned ${resolvedPath}`);
    assert.equal(
        cache.analyzedDocuments.get(resolvedPath) as any,
        `analyzed ${resolvedPath}`);
  }

  function assertNotHasDocument(cache: AnalysisCache, p: string) {
    const path = p as ResolvedUrl;
    assert.isFalse(cache.parsedDocumentPromises.has(path));
    assert.isFalse(cache.scannedDocumentPromises.has(path));
    // caller must assert on cache.analyzedDocumentPromises themselves
    assert.isFalse(cache.scannedDocuments.has(path));
    assert.isFalse(cache.analyzedDocuments.has(path));
  }

  async function assertDocumentScannedButNotResolved(
      cache: AnalysisCache, p: string) {
    const path = p as ResolvedUrl;
    assert.equal(
        await cache.parsedDocumentPromises.getOrCompute(path, null as any) as
            any,
        `parsed ${path} promise`);

    assert.equal(
        await cache.scannedDocumentPromises.getOrCompute(path, null as any) as
            any,
        `scanned ${path} promise`);
    assert.equal(cache.scannedDocuments.get(path) as any, `scanned ${path}`);
    assert.isFalse(cache.analyzedDocuments.has(path));
    assert.isFalse(cache.analyzedDocumentPromises.has(path));
  }

  test('it invalidates a path when asked to', async () => {
    const cache = new AnalysisCache();
    addFakeDocumentToCache(cache, 'index.html', []);
    addFakeDocumentToCache(cache, 'unrelated.html', []);
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');

    const forkedCache = cache.invalidate(['index.html'] as ResolvedUrl[]);
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');
    assertNotHasDocument(forkedCache, 'index.html');
    await assertHasDocument(forkedCache, 'unrelated.html');

    // The promise of unrelated.html's result has been turned into
    // a Promise.resolve() of its non-promise cache.
    assert.equal(
        await forkedCache.analyzedDocumentPromises.getOrCompute(
            'unrelated.html' as ResolvedUrl, null as any) as any,
        `analyzed unrelated.html`);
  });

  test('it invalidates the dependants of a path when asked to', async () => {
    const cache = new AnalysisCache();
    // Picture a graph where
    addFakeDocumentToCache(cache, 'index.html', ['element.html']);
    addFakeDocumentToCache(cache, 'element.html', ['behavior.html']);
    addFakeDocumentToCache(cache, 'behavior.html', []);
    addFakeDocumentToCache(cache, 'unrelated.html', []);

    // We added the documents.
    await assertHasDocument(cache, 'index.html');
    await assertHasDocument(cache, 'unrelated.html');
    await assertHasDocument(cache, 'behavior.html');
    await assertHasDocument(cache, 'unrelated.html');


    const forkedCache = cache.invalidate(['behavior.html'] as ResolvedUrl[]);
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
