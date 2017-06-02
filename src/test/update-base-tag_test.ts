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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />


import {assert} from 'chai';
import File = require('vinyl');
import * as path from 'path';

import {PolymerProject} from '../polymer-project';

const testProjectRoot = path.resolve('test-fixtures/differential-serving');

suite('updateBaseTag', () => {

  let defaultProject: PolymerProject;

  const unroot = ((p: string) => p.substring(testProjectRoot.length + 1));

  setup(() => {
    defaultProject = new PolymerProject({
      root: 'test-fixtures/differential-serving/',
      entrypoint: 'index.html',
      shell: 'shell.html',
    });
  });

  test('updates the entrypoint base tag', (done) => {
    const files = new Map();
    defaultProject.sources()
        .pipe(defaultProject.updateBaseTag('/newBase/'))
        .on('data', (f: File) => files.set(unroot(f.path), f))
        .on('data', () => {/* starts the stream */})
        .on('end', () => {
          const expectedFiles = [
            'index.html',
            'shell.html',
          ];
          assert.deepEqual(Array.from(files.keys()).sort(), expectedFiles);

          const index = files.get('index.html').contents.toString();
          assert.include(index, 'index stuff');
          assert.include(index, '<base href="/newBase/">');
          assert.notInclude(index, 'oldBase');

          const shell = files.get('shell.html').contents.toString();
          assert.include(shell, 'shell stuff');
          assert.include(shell, 'shell-stuff/');
          assert.notInclude(shell, 'newBase');
          done();
        });
  });

  test('does nothing when base tag doesn\'t need updating', (done) => {
    const files = new Map();
    defaultProject.sources()
        .pipe(defaultProject.updateBaseTag('/oldBase/'))
        .on('data', (f: File) => files.set(unroot(f.path), f))
        .on('data', () => {/* starts the stream */})
        .on('end', () => {
          const expectedFiles = [
            'index.html',
            'shell.html',
          ];
          assert.deepEqual(Array.from(files.keys()).sort(), expectedFiles);
          const index = files.get('index.html').contents.toString();
          assert.include(index, '<base href="/oldBase/">');
          done();
        });
  });
});
