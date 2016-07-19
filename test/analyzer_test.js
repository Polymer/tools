/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const assert = require('chai').assert;
const path = require('path');
const StreamAnalyzer = require('../lib/analyzer').StreamAnalyzer;
const mergeStream = require('merge-stream');
const vfs = require('vinyl-fs-fake');

suite('Analyzer', () => {

  suite('DepsIndex', () => {

    test('fragment to deps list has only uniques', (done) => {
      let root = path.resolve('test/analyzer-data');
      let fragments = [
        path.resolve(root, 'a.html'),
        path.resolve(root, 'b.html'),
      ];
      let analyzer = new StreamAnalyzer(root, null, null, fragments, fragments);
      mergeStream(
          vfs.src(path.join(root, '**'), {cwdbase: true}),
          analyzer.dependencies
        )
        .pipe(analyzer)
        .on('finish', () => {
          analyzer.analyzeDependencies.then((depsIndex) => {
            let ftd = depsIndex.fragmentToDeps;
            for (let frag of ftd.keys()) {
              assert.deepEqual(ftd.get(frag), ['shared-1.html', 'shared-2.html']);
            }
            done();
          }).catch((err) => done(err));
      });
    });

    test("analyzing shell and entrypoint doesn't double load files", (done) => {
      let root = path.resolve('test/analyzer-data');
      let sourceGlobs = [
        path.resolve(root, 'a.html'),
        path.resolve(root, 'b.html'),
      ];
      let analyzer = new StreamAnalyzer(
          root,
          path.resolve(root, 'entrypoint.html'),
          path.resolve(root, 'shell.html'),
          undefined,
          sourceGlobs);
      mergeStream(
          vfs.src(path.join(root, '**'), {cwdbase: true}),
          analyzer.dependencies
        )
        .pipe(analyzer)
        .on('finish', () => {
          analyzer.analyzeDependencies.then((depsIndex) => {
            assert.isTrue(depsIndex.depsToFragments.has('shared-2.html'));
            assert.isFalse(depsIndex.depsToFragments.has('/shell.html'));
            assert.isFalse(depsIndex.depsToFragments.has('/shared-2.html'));
            done();
          }).catch(done);
      });
    });

  });

  suite('.dependencies', () => {

    test('outputs all dependencies needed by source', (done) => {
      let root = path.resolve('test/analyzer-data');
      let shell = path.resolve(root, 'shell.html');
      let entrypoint = path.resolve(root, 'entrypoint.html');
      let sourceGlobs = [
        path.resolve(root, 'a.html'),
        path.resolve(root, 'b.html'),
      ];
      let analyzer = new StreamAnalyzer(
          root,
          entrypoint,
          shell,
          undefined,
          sourceGlobs.concat(shell, entrypoint));

      let foundDependencies = new Set();
      analyzer.dependencies.on('data', (file) => {
        foundDependencies.add(file.path);
      });

      mergeStream(
          vfs.src(sourceGlobs.concat(shell, entrypoint), {cwdbase: true}),
          analyzer.dependencies
        )
        .pipe(analyzer)
        .on('finish', () => {
          // shared-1 is never imported by shell/entrypoint, so it is not included as a dep.
          assert.isFalse(foundDependencies.has(path.resolve(root, 'shared-1.html')));
          // shared-2 is imported by shell, so it is included as a dep.
          assert.isTrue(foundDependencies.has(path.resolve(root, 'shared-2.html')));
          done();
        })
        .on('error', done);
    });

    test('outputs all dependencies needed by source and given fragments', (done) => {
      let root = path.resolve('test/analyzer-data');
      let shell = path.resolve(root, 'shell.html');
      let entrypoint = path.resolve(root, 'entrypoint.html');
      let sourceGlobs = [
        path.resolve(root, 'a.html'),
        path.resolve(root, 'b.html'),
      ];
      let analyzer = new StreamAnalyzer(
          root,
          entrypoint,
          shell,
          sourceGlobs,
          sourceGlobs.concat(shell, entrypoint));

      let foundDependencies = new Set();
      analyzer.dependencies.on('data', (file) => {
        foundDependencies.add(file.path);
      });

      mergeStream(
          vfs.src(sourceGlobs.concat(shell, entrypoint), {cwdbase: true}),
          analyzer.dependencies
        )
        .pipe(analyzer)
        .on('finish', () => {
          // shared-1 is imported by 'a' & 'b', so it is included as a dep.
          assert.isTrue(foundDependencies.has(path.resolve(root, 'shared-1.html')));
          // shared-1 is imported by 'a' & 'b', so it is included as a dep.
          assert.isTrue(foundDependencies.has(path.resolve(root, 'shared-2.html')));
          done();
        })
        .on('error', done);
    });
  });

});
