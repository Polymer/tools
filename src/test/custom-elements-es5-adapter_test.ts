
/// <reference path="../../node_modules/@types/mocha/index.d.ts" />


import {assert} from 'chai';
import File = require('vinyl');
import * as path from 'path';

import {PolymerProject} from '../polymer-project';

const testProjectRoot =
    path.resolve('test-fixtures/custom-elements-es5-adapter');

suite('Custom Elements ES5 Adapter', () => {

  let defaultProject: PolymerProject;

  const unroot = ((p: string) => p.substring(testProjectRoot.length + 1));

  setup(() => {
    defaultProject = new PolymerProject({
      root: 'test-fixtures/custom-elements-es5-adapter/',
      entrypoint: 'index.html',
      shell: 'shell.html',
      sources: [
        'source-dir/**',
      ],
    });
  });

  test('injects the custom elements es5 adapter in index', (done) => {
    const webcomponentsLoaderFilname = 'webcomponents-loader.js';
    const injectedAdapterFilename = 'custom-elements-es5-adapter.js';
    const files = new Map();
    defaultProject.sources()
        .pipe(defaultProject.addCustomElementsEs5Adapter())
        .on('data', (f: File) => files.set(unroot(f.path), f))
        .on('data', () => {/* starts the stream */})
        .on('end', () => {
          const expectedFiles = [
            'index.html',
            'shell.html',
          ];
          assert.deepEqual(Array.from(files.keys()).sort(), expectedFiles);
          const index = files.get('index.html').contents.toString();
          const shell = files.get('shell.html').contents.toString();
          assert.include(index, injectedAdapterFilename);
          assert.include(index, webcomponentsLoaderFilname);
          assert.isAbove(
              index.indexOf(webcomponentsLoaderFilname),
              index.indexOf(injectedAdapterFilename));
          assert.notInclude(shell, injectedAdapterFilename);
          done();
        });
  });
});
