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

import {Analyzer} from '../../analyzer';
import {DependencyGraph} from '../../core/dependency-graph';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

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
    assertStringSetsEqual(graph.getAllDependantsOf('common.html'), []);
    graph.addDependenciesOf('a.html', ['common.html']);
    assertStringSetsEqual(graph.getAllDependantsOf('common.html'), ['a.html']);
    graph.addDependenciesOf('b.html', ['common.html']);
    assertStringSetsEqual(
        graph.getAllDependantsOf('common.html'), ['a.html', 'b.html']);
    graph.addDependenciesOf('base.html', ['a.html', 'b.html']);
    assertStringSetsEqual(
        graph.getAllDependantsOf('common.html'),
        ['a.html', 'b.html', 'base.html']);
    graph = graph.invalidatePaths(['a.html']);
    assertStringSetsEqual(
        graph.getAllDependantsOf('common.html'), ['b.html', 'base.html']);
    graph = graph.invalidatePaths(['b.html']);
    assertStringSetsEqual(graph.getAllDependantsOf('common.html'), []);
  });

  /**
   * Like many integration tests this is a bit dirty, but it catches many
   * interesting bugs in the way that we construct the dependency graph in
   * practice.
   */
  suite('as used in the Analyzer', () => {
    let analyzer: Analyzer;
    setup(() => {
      analyzer = new Analyzer(
          {urlLoader: new FSUrlLoader(path.join(__dirname, '..', 'static'))});
    });

    function assertImportersOf(path: string, expectedDependants: string[]) {
      assertStringSetsEqual(
          analyzer['_cacheContext']['_cache']['dependencyGraph']
              .getAllDependantsOf(path),
          expectedDependants);
    }

    test('works with a basic document with no dependencies', async() => {
      await analyzer.analyze('dependencies/leaf.html');
      assertImportersOf('dependencies/leaf.html', []);
    });

    test('works with a simple tree of dependencies', async() => {
      await analyzer.analyze('dependencies/root.html');
      assertImportersOf('dependencies/root.html', []);

      assertImportersOf('dependencies/leaf.html', ['dependencies/root.html']);
      assertImportersOf('dependencies/subfolder/subfolder-sibling.html', [
        'dependencies/subfolder/in-folder.html',
        'dependencies/inline-and-imports.html',
        'dependencies/root.html'
      ]);
    });
  });
});
