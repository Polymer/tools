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

/// <reference path="../../../node_modules/@types/mocha/index.d.ts" />

import {assert, use} from 'chai';

import {Analyzer} from '../../core/analyzer';
import {DependencyGraph} from '../../core/dependency-graph';

import chaiAsPromised = require('chai-as-promised');
import {ResolvedUrl} from '../../model/url';
import {resolvedUrl, fixtureDir} from '../test-utils';
use(chaiAsPromised);

suite('DependencyGraph', () => {
  function assertStringSetsEqual(
      actual: Set<string>, expected: Iterable<string>, message?: string) {
    assert.deepEqual(
        Array.from(actual).sort(), Array.from(expected).sort(), message);
  }

  test('can calculate dependants', () => {
    // Testing building up and then tearing back down the graph:
    // base.html -> a.html -> common.html
    // base.html -> b.html -> common.html
    let graph = new DependencyGraph();
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`), []);
    graph.addDocument(resolvedUrl`a.html`, [resolvedUrl`common.html`]);
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`), ['a.html']);
    graph.addDocument(resolvedUrl`b.html`, [resolvedUrl`common.html`]);
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`),
        ['a.html', 'b.html']);
    graph.addDocument(
        resolvedUrl`base.html`, ['a.html', 'b.html'] as ResolvedUrl[]);
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`),
        ['a.html', 'b.html', 'base.html']);
    graph = graph.invalidatePaths([resolvedUrl`a.html`]);
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`),
        ['b.html', 'base.html']);
    graph = graph.invalidatePaths([resolvedUrl`b.html`]);
    assertStringSetsEqual(
        graph.getAllDependantsOf(resolvedUrl`common.html`), []);
    assertIsValidGraph(graph);
  });

  /**
   * Like many integration tests this is a bit dirty, but it catches many
   * interesting bugs in the way that we construct the dependency graph in
   * practice.
   */
  suite('as used in the Analyzer', () => {
    let analyzer: Analyzer;
    setup(() => {
      analyzer = Analyzer.createForDirectory(fixtureDir);
    });

    async function assertImportersOf(
        path: string, expectedDependants: string[]) {
      const graph = await getLatestDependencyGraph(analyzer);
      assertStringSetsEqual(
          graph.getAllDependantsOf(analyzer.resolveUrl(path)!),
          expectedDependants.map((u) => analyzer.resolveUrl(u)!));
    };

    test('works with a basic document with no dependencies', async () => {
      await analyzer.analyze(['dependencies/leaf.html']);
      await assertImportersOf('dependencies/leaf.html', []);
      const graph = await getLatestDependencyGraph(analyzer);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
    });

    test('works with a simple tree of dependencies', async () => {
      await analyzer.analyze(['dependencies/root.html']);
      await assertImportersOf('dependencies/root.html', []);

      await assertImportersOf(
          'dependencies/leaf.html', ['dependencies/root.html']);
      await assertImportersOf('dependencies/subfolder/subfolder-sibling.html', [
        'dependencies/subfolder/in-folder.html',
        'dependencies/inline-and-imports.html',
        'dependencies/root.html'
      ]);
      const graph = await getLatestDependencyGraph(analyzer);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
    });
  });

  suite('whenReady', () => {
    test('resolves for a single added document', async () => {
      const graph = new DependencyGraph();
      const done = graph.whenReady(resolvedUrl`a`);
      graph.addDocument(resolvedUrl`a`, []);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
      await done;
    });

    test('resolves for a single rejected document', async () => {
      const graph = new DependencyGraph();
      const done = graph.whenReady(resolvedUrl`a`);
      graph.rejectDocument(resolvedUrl`a`, new Error('because'));
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
      await done;
    });

    test('resolves for a document with an added dependency', async () => {
      const graph = new DependencyGraph();
      const done = graph.whenReady(resolvedUrl`a`);
      graph.addDocument(resolvedUrl`a`, [resolvedUrl`b`]);
      graph.addDocument(resolvedUrl`b`, []);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
      await done;
    });

    test('resolves for a document with a rejected dependency', async () => {
      const graph = new DependencyGraph();
      const done = graph.whenReady(resolvedUrl`a`);
      graph.addDocument(resolvedUrl`a`, [resolvedUrl`b`]);
      graph.rejectDocument(resolvedUrl`b`, new Error('because'));
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
      await done;
    });

    test('resolves for a simple cycle', async () => {
      const graph = new DependencyGraph();
      const promises =
          [graph.whenReady(resolvedUrl`a`), graph.whenReady(resolvedUrl`b`)];
      graph.addDocument(resolvedUrl`a`, ['b'] as ResolvedUrl[]);
      graph.addDocument(resolvedUrl`b`, ['a'] as ResolvedUrl[]);
      await Promise.all(promises);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
    });

    test('does not resolve early for a cycle with a leg', async () => {
      const graph = new DependencyGraph();
      let cResolved = false;
      const aReady = graph.whenReady(resolvedUrl`a`).then(() => {
        assert.isTrue(cResolved);
      });
      const bReady = graph.whenReady(resolvedUrl`b`).then(() => {
        assert.isTrue(cResolved);
      });
      graph.addDocument(resolvedUrl`a`, ['b', 'c'] as ResolvedUrl[]);
      graph.addDocument(resolvedUrl`b`, ['a'] as ResolvedUrl[]);
      await Promise.resolve();
      cResolved = true;
      graph.addDocument(resolvedUrl`c`, []);
      await Promise.all([aReady, bReady]);
      assertGraphIsSettled(graph);
      assertIsValidGraph(graph);
    });
  });
});

/**
 * Asserts that all records in the graph have had all of their dependencies
 * resolved or rejected.
 */
function assertGraphIsSettled(graph: DependencyGraph) {
  for (const record of graph['_documents'].values()) {
    if (!(record.dependenciesDeferred.resolved ||
          record.dependenciesDeferred.rejected)) {
      assert.fail(
          false,
          true,
          `found unsettled record for url '${
              record.url}' in graph that should be settled`);
    }
  }
}

/**
 * Asserts that for every record in the graph, each outgoing link is matched
 * by an incoming link on the other side, and vice versa.
 *
 * Since DependencyGraph tracks both incoming and outgoing links (dependencies
 * and dependants), when there is a dependency A -> B, both A and B should be
 * aware of that dependency link.
 */
function assertIsValidGraph(graph: DependencyGraph) {
  for (const record of graph['_documents'].values()) {
    for (const dependency of record.dependencies) {
      const dependencyRecord = graph['_documents'].get(dependency);
      assert.isTrue(
          dependencyRecord !== undefined,
          `dependency record for ${dependency} should exist,` +
              ` as it is referenced by ${record.url}.`);
      assert.isTrue(
          dependencyRecord!.dependants.has(record.url),
          `${dependency} should know about its dependant ${record.url}`);
    }
    for (const dependant of record.dependants) {
      const dependantRecord = graph['_documents'].get(dependant);
      assert.isTrue(
          dependantRecord !== undefined,
          `dependant record for ${dependant} should exist,` +
              ` as it is referenced by ${record.url}.`);
      assert.isTrue(
          dependantRecord!.dependencies.has(record.url),
          `${dependant} should know about its dependency ${record.url}`);
    }
  }
}

async function getLatestDependencyGraph(analyzer: Analyzer) {
  const context = await analyzer['_analysisComplete'];
  return context['_cache'].dependencyGraph;
}
