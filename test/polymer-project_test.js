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
const stream = require('stream');
const File = require('vinyl');

const PolymerProject = require('../lib/polymer-project').PolymerProject;

suite('PolymerProject', () => {

  let project;
  let root = path.resolve(__dirname, 'test-project');

  let unroot = (p) => p.substring(root.length + 1);

  setup(() => {
    project = new PolymerProject({
      root: path.resolve(__dirname, 'test-project'),
      entrypoint: 'index.html',
      shell: 'shell.html',
    });
  })

  test('reads sources', (done) => {
    let files = [];
    project.sources()
      .on('data', (f) => files.push(f))
      .on('end', () => {
        let names = files.map((f) => unroot(f.path));
        let expected = [
          'index.html',
          'shell.html',
          // note, we'll probably want to exclude certain files by defult in
          // the future
          'gulpfile.js',
        ];
        assert.sameMembers(names, expected);
        done();
      });
  });

  test('reads dependencies', (done) => {
    let files = [];
    project.dependencies()
      .on('data', (f) => files.push(f))
      .on('end', () => {
        let names = files.map((f) => unroot(f.path));
        let expected = [
          'bower_components/dep.html',
        ];
        assert.sameMembers(names, expected);
        done();
      });
  });

  test('splits and rejoins scripts', (done) => {
    let splitFiles = new Map();
    let joinedFiles = new Map();
    project.sources()
      .pipe(project.splitHtml())
      .on('data', (f) => splitFiles.set(unroot(f.path), f))
      .pipe(project.rejoinHtml())
      .on('data', (f) => joinedFiles.set(unroot(f.path), f))
      .on('end', () => {
        let expectedSplitFiles = [
          'index.html',
          'shell.html_script_0.js',
          'shell.html',
          'gulpfile.js',
        ];
        let expectedJoinedFiles = [
          'index.html',
          'shell.html',
          'gulpfile.js',
        ];
        assert.sameMembers(Array.from(splitFiles.keys()), expectedSplitFiles);
        assert.sameMembers(Array.from(joinedFiles.keys()), expectedJoinedFiles);
        assert.include(
          splitFiles.get('shell.html_script_0.js').contents.toString(),
          `console.log('shell');`);
        assert.notInclude(
          splitFiles.get('shell.html').contents.toString(),
          `console.log('shell');`);
        assert.include(
          joinedFiles.get('shell.html').contents.toString(),
          `console.log('shell');`);
        done();
      });
  });

  test('split/rejoin deals with bad paths', (done) => {
    let sourceStream = new stream.Readable({
      objectMode: true,
    });
    let root = path.normalize('/foo');
    let filepath = path.join(root, '/bar/baz.html');
    let source =
      '<html><head><script>fooify();</script></head><body></body></html>';
    let file = new File({
      cwd: root,
      base: root,
      path: filepath,
      contents: new Buffer(source),
    });

    sourceStream
      .pipe(project.splitHtml())
      .on('data', (file) => {
        // this is what gulp-html-minifier does...
        if (path.sep === '\\' && file.path.endsWith('.html')) {
          file.path = file.path.replace('\\', '/');
        }
      })
      .pipe(project.rejoinHtml())
      .on('data', (file) => {
        let contents = file.contents.toString();
        assert.equal(contents, source);
      })
      .on('finish', () => done())
      .on('error', (error) => done(error));

    sourceStream.push(file);
    sourceStream.push(null);
  });

});
