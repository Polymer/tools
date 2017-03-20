
/// <reference path="../../node_modules/@types/mocha/index.d.ts" />


import {assert} from 'chai';
import File = require('vinyl');
import * as path from 'path';
import * as stream from 'stream';

import {PolymerProject} from '../polymer-project';
import {HtmlSplitter} from '../html-splitter';

const testProjectRoot = path.resolve('test-fixtures/splitter-project');

suite('HtmlSplitter', () => {

  let defaultProject: PolymerProject;

  const unroot = ((p: string) => p.substring(testProjectRoot.length + 1));

  setup(() => {
    defaultProject = new PolymerProject({
      root: 'test-fixtures/splitter-project/',
      entrypoint: 'index.html',
      shell: 'shell.html',
      sources: [
        'source-dir/**',
      ],
    });
  });

  test('splits scripts', (done) => {
    const htmlSplitter = new HtmlSplitter();
    const splitFiles = new Map();
    defaultProject.sources()
        .pipe(htmlSplitter.split())
        .on('data', (f: File) => splitFiles.set(unroot(f.path), f))
        .pipe(htmlSplitter.rejoin())
        .on('data', () => {/* starts the stream */})
        .on('end', () => {
          const expectedSplitFiles = [
            'index.html',
            'shell.html',
            'shell.html_script_0.js',
            'shell.html_script_1.js',
            path.join('source-dir', 'my-app.html'),
          ];
          assert.deepEqual(
              Array.from(splitFiles.keys()).sort(), expectedSplitFiles);
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
          done();
        });
  });

  test('rejoins scripts', (done) => {
    const htmlSplitter = new HtmlSplitter();
    const joinedFiles = new Map();
    defaultProject.sources()
        .pipe(htmlSplitter.split())
        .pipe(htmlSplitter.rejoin())
        .on('data', (f: File) => joinedFiles.set(unroot(f.path), f))
        .on('end', () => {
          const expectedJoinedFiles = [
            'index.html',
            'shell.html',
            path.join('source-dir', 'my-app.html'),
          ];
          assert.deepEqual(
              Array.from(joinedFiles.keys()).sort(), expectedJoinedFiles);
          assert.include(
              joinedFiles.get('shell.html').contents.toString(), `console.log`);
          done();
        });
  });

  test('handles bad paths', (done) => {
    const htmlSplitter = new HtmlSplitter();
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

    sourceStream.pipe(htmlSplitter.split())
        .on('data',
            (file: File) => {
              // this is what gulp-html-minifier does...
              if (path.sep === '\\' && file.path.endsWith('.html')) {
                file.path = file.path.replace('\\', '/');
              }
            })
        .pipe(htmlSplitter.rejoin())
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
