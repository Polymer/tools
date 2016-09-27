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
const ProjectConfig = require('polymer-project-config').ProjectConfig;

suite('Analyzer', () => {

  suite('DepsIndex', () => {

    test('fragment to deps list has only uniques', (done) => {
      const root = `test/static/analyzer-data`;
      const sourceFiles = ['a.html', 'b.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
      const config = new ProjectConfig({
        root: root,
        entrypoint: 'entrypoint.html',
        fragments: [
          'a.html',
          'b.html',
        ],
        sources: sourceFiles,
      });
      const analyzer = new StreamAnalyzer(config);
      mergeStream(
          vfs.src(sourceFiles, {cwdbase: true}),
          analyzer.dependencies
        )
        .pipe(analyzer)
        .on('finish', () => {
          analyzer.analyzeDependencies.then((depsIndex) => {
            const ftd = depsIndex.fragmentToDeps;
            for (const frag of ftd.keys()) {
              assert.deepEqual(ftd.get(frag), ['shared-1.html', 'shared-2.html']);
            }
            done();
          }).catch((err) => done(err));
      });
    });

    test("analyzing shell and entrypoint doesn't double load files", (done) => {
      const root = `test/static/analyzer-data`;
      const sourceFiles = ['shell.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
      const config = new ProjectConfig({
        root: root,
        entrypoint: 'entrypoint.html',
        shell: 'shell.html',
        sources: sourceFiles,
      });
      let analyzer = new StreamAnalyzer(config);
      mergeStream(
          vfs.src(sourceFiles, {cwdbase: true}),
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
      const root = `test/static/analyzer-data`;
      const sourceFiles = ['shell.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
      const config = new ProjectConfig({
        root: root,
        entrypoint: 'entrypoint.html',
        shell: 'shell.html',
        sources: sourceFiles,
      });
      let analyzer = new StreamAnalyzer(config);
      let foundDependencies = new Set();
      analyzer.dependencies.on('data', (file) => {
        foundDependencies.add(file.path);
      });

      mergeStream(
          vfs.src(sourceFiles, {cwdbase: true}),
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
      const root = `test/static/analyzer-data`;
      const sourceFiles = ['a.html', 'b.html', 'shell.html', 'entrypoint.html'].map((p) => path.resolve(root, p));
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
      let analyzer = new StreamAnalyzer(config);
      let foundDependencies = new Set();
      analyzer.dependencies.on('data', (file) => {
        foundDependencies.add(file.path);
      });

      mergeStream(
          vfs.src(sourceFiles, {cwdbase: true}),
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
