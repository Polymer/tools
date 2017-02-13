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
import File = require('vinyl');
import * as path from 'path';

import {getFlowingState} from './util';
import {PolymerProject} from '../polymer-project';
import {waitFor} from '../streams';

const testProjectRoot = path.resolve('test-fixtures/test-project');

suite('PolymerProject', () => {

  let defaultProject: PolymerProject;

  const unroot = ((p: string) => p.substring(testProjectRoot.length + 1));

  setup(() => {
    defaultProject = new PolymerProject({
      root: 'test-fixtures/test-project/',
      entrypoint: 'index.html',
      shell: 'shell.html',
      sources: [
        'source-dir/**',
      ],
    });
  });

  test('will not throw an exception when created with minimum options', () => {
    new PolymerProject({
      root: 'test-fixtures/test-project/',
    });
  });

  test('reads sources', (done) => {
    const files: File[] = [];
    defaultProject.sources()
        .on('data', (f: File) => files.push(f))
        .on('end', () => {
          const names = files.map((f) => unroot(f.path));
          const expected = [
            'index.html',
            'shell.html',
            'source-dir/my-app.html',
          ];
          assert.sameMembers(names, expected);
          done();
        });
  });

  test('the sources & dependencies streams remain paused until use', () => {
    // Check that data isn't flowing through sources until consumer usage
    const sourcesStream = defaultProject.sources();
    assert.isNull(getFlowingState(sourcesStream));
    sourcesStream.on('data', () => {});
    assert.isTrue(getFlowingState(sourcesStream));

    // Check that data isn't flowing through dependencies until consumer usage
    const dependencyStream = defaultProject.dependencies();
    assert.isNull(getFlowingState(dependencyStream));
    dependencyStream.on('data', () => {});
    assert.isTrue(getFlowingState(dependencyStream));
  });

  suite('.dependencies()', () => {

    test('reads dependencies', (done) => {
      const files: File[] = [];
      const dependencyStream = defaultProject.dependencies();
      dependencyStream.on('data', (f: File) => files.push(f));
      dependencyStream.on('end', () => {
        const names = files.map((f) => unroot(f.path));
        const expected = [
          'bower_components/dep.html',
          'bower_components/loads-external-dependencies.html',
        ];
        assert.sameMembers(names, expected);
        done();
      });
    });

    test(
        'reads dependencies in a monolithic (non-shell) application without timing out',
        () => {
          const project = new PolymerProject({
            root: testProjectRoot,
            entrypoint: 'index.html',
            sources: [
              'source-dir/**',
              'index.html',
              'shell.html',
            ],
          });

          let dependencyStream = project.dependencies();
          dependencyStream.on('data', () => {});
          return waitFor(dependencyStream);
        });

    test(
        'reads dependencies and includes additionally provided files',
        (done) => {
          const files: File[] = [];
          const projectWithIncludedDeps = new PolymerProject({
            root: testProjectRoot,
            entrypoint: 'index.html',
            shell: 'shell.html',
            sources: [
              'source-dir/**',
            ],
            extraDependencies: [
              'bower_components/unreachable*',
            ],
          });

          const dependencyStream = projectWithIncludedDeps.dependencies();
          dependencyStream.on('data', (f: File) => files.push(f));
          dependencyStream.on('error', done);
          dependencyStream.on('end', () => {
            const names = files.map((f) => unroot(f.path));
            const expected = [
              'bower_components/dep.html',
              'bower_components/unreachable-dep.html',
              'bower_components/loads-external-dependencies.html',
            ];
            assert.sameMembers(names, expected);
            done();
          });
        });

  });

});
