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
import * as stream from 'stream';

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

  test('splits and rejoins scripts', (done) => {
    const splitFiles = new Map();
    const joinedFiles = new Map();
    defaultProject.sources()
        .pipe(defaultProject.splitHtml())
        .on('data', (f: File) => splitFiles.set(unroot(f.path), f))
        .pipe(defaultProject.rejoinHtml())
        .on('data', (f: File) => joinedFiles.set(unroot(f.path), f))
        .on('end', () => {
          const expectedSplitFiles = [
            'index.html',
            'shell.html_script_0.js',
            'shell.html_script_1.js',
            'shell.html',
            'source-dir/my-app.html',
          ];
          const expectedJoinedFiles = [
            'index.html',
            'shell.html',
            'source-dir/my-app.html',
          ];
          assert.sameMembers(Array.from(splitFiles.keys()), expectedSplitFiles);
          assert.sameMembers(
              Array.from(joinedFiles.keys()), expectedJoinedFiles);
          assert.include(
              splitFiles.get('shell.html_script_0.js').contents.toString(),
              `console.log('shell');`);
          assert.include(
              splitFiles.get('shell.html_script_1.js').contents.toString(),
              `console.log('shell 2');`);
          assert.notInclude(
              splitFiles.get('shell.html').contents.toString(), `console.log`);
          assert.include(
              splitFiles.get('shell.html').contents.toString(),
              `# I am markdown`);
          assert.include(
              joinedFiles.get('shell.html').contents.toString(), `console.log`);
          done();
        });
  });

  test('split/rejoin deals with bad paths', (done) => {
    const sourceStream = new stream.Readable({
      objectMode: true,
    });
    const root = path.normalize('/foo');
    const filepath = path.join(root, '/bar/baz.html');
    const source =
        '<html><head><script>fooify();</script></head><body></body></html>';
    const file = new File({
      cwd: root,
      base: root,
      path: filepath,
      contents: new Buffer(source),
    });

    sourceStream.pipe(defaultProject.splitHtml())
        .on('data',
            (file: File) => {
              // this is what gulp-html-minifier does...
              if (path.sep === '\\' && file.path.endsWith('.html')) {
                file.path = file.path.replace('\\', '/');
              }
            })
        .pipe(defaultProject.rejoinHtml())
        .on('data',
            (file: File) => {
              const contents = file.contents.toString();
              assert.equal(contents, source);
            })
        .on('finish', done)
        .on('error', done);

    sourceStream.push(file);
    sourceStream.push(null);
  });

});
