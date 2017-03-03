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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert} from 'chai';
import * as path from 'path';
import File = require('vinyl');
import {ProjectConfig} from 'polymer-project-config';
import * as sinon from 'sinon';
import {Writable} from 'stream';

import {getFlowingState} from './util';
import {BuildAnalyzer} from '../analyzer';
import {waitForAll} from '../streams';

/**
 * Streams will remain paused unless something is listening for it's data.
 * NoopStream is useful for piping to if you just want the stream to run and end
 * successfully without checking the data passed through it.
 */
class NoopStream extends Writable {
  constructor() {
    super({objectMode: true});
  }
  _write(_chunk: any, _encoding?: string, callback?: Function): void {
    callback();
  }
}

suite('Analyzer', () => {

  suite('DepsIndex', () => {

    test('fragment to deps list has only uniques', () => {
      const config = new ProjectConfig({
        root: `test-fixtures/analyzer-data`,
        entrypoint: 'entrypoint.html',
        fragments: [
          'a.html',
          'b.html',
        ],
        sources: ['a.html', 'b.html', 'entrypoint.html'],
      });

      const analyzer = new BuildAnalyzer(config);
      analyzer.sources().pipe(new NoopStream());
      analyzer.dependencies().pipe(new NoopStream());

      return waitForAll([analyzer.sources(), analyzer.dependencies()])
          .then(() => {
            return analyzer.analyzeDependencies;
          })
          .then((depsIndex) => {
            const ftd = depsIndex.fragmentToDeps;
            for (const frag of ftd.keys()) {
              assert.deepEqual(
                  ftd.get(frag), ['shared-1.html', 'shared-2.html']);
            }
          });
    });

    test('analyzing shell and entrypoint doesn\'t double load files', () => {
      const root = `test-fixtures/analyzer-data`;
      const sourceFiles =
          ['shell.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
      const config = new ProjectConfig({
        root: root,
        entrypoint: 'entrypoint.html',
        shell: 'shell.html',
        sources: sourceFiles,
      });

      let analyzer = new BuildAnalyzer(config);
      analyzer.sources().pipe(new NoopStream());
      analyzer.dependencies().pipe(new NoopStream());

      return waitForAll([analyzer.sources(), analyzer.dependencies()])
          .then(() => {
            return analyzer.analyzeDependencies;
          })
          .then((depsIndex) => {
            assert.isTrue(depsIndex.depsToFragments.has('shared-2.html'));
            assert.isFalse(depsIndex.depsToFragments.has('/shell.html'));
            assert.isFalse(depsIndex.depsToFragments.has('/shared-2.html'));
          });
    });

  });

  suite('.dependencies', () => {

    test('outputs all dependencies needed by source', () => {
      const foundDependencies = new Set();
      const root = `test-fixtures/analyzer-data`;
      const sourceFiles =
          ['shell.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
      const config = new ProjectConfig({
        root: root,
        entrypoint: 'entrypoint.html',
        shell: 'shell.html',
        sources: sourceFiles,
      });

      let analyzer = new BuildAnalyzer(config);
      analyzer.sources().pipe(new NoopStream());
      analyzer.dependencies().on('data', (file: File) => {
        foundDependencies.add(file.path);
      });

      return waitForAll([analyzer.sources(), analyzer.dependencies()])
          .then(() => {
            // shared-1 is never imported by shell/entrypoint, so it is not
            // included as a dep.
            assert.isFalse(
                foundDependencies.has(path.resolve(root, 'shared-1.html')));
            // shared-2 is imported by shell, so it is included as a dep.
            assert.isTrue(
                foundDependencies.has(path.resolve(root, 'shared-2.html')));
          });
    });

    test(
        'outputs all dependencies needed by source and given fragments', () => {
          const foundDependencies = new Set();
          const root = `test-fixtures/analyzer-data`;
          const sourceFiles =
              ['a.html', 'b.html', 'shell.html', 'entrypoint.html'].map(
                  (p) => path.resolve(root, p));
          const config = new ProjectConfig({
            root: root,
            entrypoint: 'entrypoint.html',
            shell: 'shell.html',
            fragments: [
              'a.html',
              'b.html',
            ],
            sources: sourceFiles,
          });
          const analyzer = new BuildAnalyzer(config);
          analyzer.sources().pipe(new NoopStream());
          analyzer.dependencies().on('data', (file: File) => {
            foundDependencies.add(file.path);
          });

          return waitForAll([analyzer.sources(), analyzer.dependencies()])
              .then(() => {
                // shared-1 is imported by 'a' & 'b', so it is included as a
                // dep.
                assert.isTrue(
                    foundDependencies.has(path.resolve(root, 'shared-1.html')));
                // shared-1 is imported by 'a' & 'b', so it is included as a
                // dep.
                assert.isTrue(
                    foundDependencies.has(path.resolve(root, 'shared-2.html')));
              });
        });

  });

  test(
      'propagates an error when a dependency filepath is analyzed but cannot be found',
      (done) => {
        const root = `test-fixtures/bad-src-import`;
        const config = new ProjectConfig({
          root: root,
          entrypoint: 'index.html',
          sources: ['src/**/*'],
        });
        const analyzer = new BuildAnalyzer(config);

        let errorCounter = 0;
        const errorListener = (err: Error) => {
          assert.equal(err.message, '1 error(s) occurred during build.');
          errorCounter++;
          if (errorCounter >= 2) {
            done();
          }
        };

        analyzer.sources().pipe(new NoopStream());
        analyzer.sources().on('error', errorListener);
        analyzer.dependencies().pipe(new NoopStream());
        analyzer.dependencies().on('error', errorListener);
      });

  test(
      'propagates an error when a source filepath is analyzed but cannot be found',
      (done) => {
        const root = `test-fixtures/bad-dependency-import`;
        const config = new ProjectConfig({
          root: root,
          entrypoint: 'index.html',
          sources: ['src/**/*'],
        });
        const analyzer = new BuildAnalyzer(config);

        analyzer.dependencies().pipe(new NoopStream());
        analyzer.dependencies().on('error', (err: Error) => {
          assert.match(
              err.message,
              /ENOENT\: no such file or directory.*does\-not\-exist\-in\-dependencies\.html/);
          done();
        });
      });

  test(
      'both file streams will emit a analysis warning of type "error"',
      (done) => {
        const root = path.resolve('test-fixtures/project-analysis-error');
        const sourceFiles = path.join(root, '**');
        const config = new ProjectConfig({
          root: root,
          sources: [sourceFiles],
        });
        const analyzer = new BuildAnalyzer(config);

        let errorCounter = 0;
        const errorListener = (err: Error) => {
          assert.equal(err.message, '1 error(s) occurred during build.');
          errorCounter++;
          if (errorCounter >= 2) {
            done();
          }
        };

        analyzer.sources().pipe(new NoopStream());
        analyzer.sources().on('error', errorListener);
        analyzer.dependencies().pipe(new NoopStream());
        analyzer.dependencies().on('error', errorListener);
      });

  test(
      'the analyzer stream will log all analysis warnings at the end of the stream',
      () => {
        const root = path.resolve('test-fixtures/project-analysis-error');
        const sourceFiles = path.join(root, '**');
        const config = new ProjectConfig({
          root: root,
          sources: [sourceFiles],
        });

        let prematurePrintWarnings = false;
        const prematurePrintWarningsCheck = () => prematurePrintWarnings =
            prematurePrintWarnings ||
            analyzer.allFragmentsToAnalyze.size > 0 && printWarningsSpy.called;
        const analyzer = new BuildAnalyzer(config);
        const printWarningsSpy = sinon.spy(analyzer, 'printWarnings');

        analyzer.sources().on('data', prematurePrintWarningsCheck);
        analyzer.dependencies().on('data', prematurePrintWarningsCheck);

        return waitForAll([analyzer.sources(), analyzer.dependencies()])
            .then(
                () => {
                  throw new Error('Parse error expected!');
                },
                (_err: Error) => {
                  assert.isFalse(prematurePrintWarnings);
                  assert.isTrue(printWarningsSpy.calledOnce);
                });
      });

  test('calling sources() starts analysis', async() => {
    const config = new ProjectConfig({
      root: `test-fixtures/analyzer-data`,
      entrypoint: 'entrypoint.html',
      fragments: [
        'a.html',
        'b.html',
      ],
      sources: ['a.html', 'b.html', 'entrypoint.html'],
    });

    const analyzer = new BuildAnalyzer(config);
    assert.isFalse(analyzer.started);
    analyzer.sources().pipe(new NoopStream());
    assert.isTrue(analyzer.started);
  });


  test('calling dependencies() starts analysis', () => {
    const config = new ProjectConfig({
      root: `test-fixtures/analyzer-data`,
      entrypoint: 'entrypoint.html',
      fragments: [
        'a.html',
        'b.html',
      ],
      sources: ['a.html', 'b.html', 'entrypoint.html'],
    });

    const analyzer = new BuildAnalyzer(config);
    assert.isFalse(analyzer.started);
    analyzer.dependencies().pipe(new NoopStream());
    assert.isTrue(analyzer.started);
  });

  test('the source/dependency streams remain paused until use', () => {
    const config = new ProjectConfig({
      root: `test-fixtures/analyzer-data`,
      entrypoint: 'entrypoint.html',
      fragments: [
        'a.html',
        'b.html',
      ],
      sources: ['a.html', 'b.html', 'entrypoint.html'],
    });
    const analyzer = new BuildAnalyzer(config);

    // Cast analyzer to <any> so that we can check private properties of it.
    // We need to access these private streams directly because the public
    // `sources()` and `dependencies()` functions have intentional side effects
    // related to these streams that we are trying to test here.
    const analyzerWithPrivates: any = analyzer;
    assert.isUndefined(analyzerWithPrivates._sourcesStream);
    assert.isUndefined(analyzerWithPrivates._dependenciesStream);
    analyzerWithPrivates.sources();
    assert.isDefined(analyzerWithPrivates._sourcesStream);
    assert.isDefined(analyzerWithPrivates._dependenciesStream);
    assert.isTrue(getFlowingState(analyzerWithPrivates._sourcesStream));
    assert.isTrue(getFlowingState(analyzerWithPrivates._dependenciesStream));

    // Check that even though `sources()` has been called, the public file
    // streams aren't flowing until data listeners are attached (directly or via
    // piping) so that files are never lost).
    assert.isNull(getFlowingState(analyzer.sources()));
    assert.isNull(getFlowingState(analyzer.dependencies()));
    analyzer.sources().on('data', () => {});
    assert.isTrue(getFlowingState(analyzer.sources()));
    assert.isNull(getFlowingState(analyzer.dependencies()));
    analyzer.dependencies().pipe(new NoopStream());
    assert.isTrue(getFlowingState(analyzer.sources()));
    assert.isTrue(getFlowingState(analyzer.dependencies()));
  });

  // TODO(fks) 10-26-2016: Refactor logging to be testable, and configurable by
  // the consumer.
  suite.skip('.printWarnings()', () => {});
});
