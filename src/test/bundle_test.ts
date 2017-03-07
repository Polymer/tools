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
import {ProjectConfig, ProjectOptions} from 'polymer-project-config';
import File = require('vinyl');
import * as dom5 from 'dom5';
import {ASTNode, parse as parse5} from 'parse5';
import * as path from 'path';
import {Transform} from 'stream';
const mergeStream = require('merge-stream');

import {BuildAnalyzer} from '../analyzer';
import {BuildBundler} from '../bundle';

const defaultRoot = path.resolve('test-fixtures/bundler-data');

class Prepender extends Transform {
  headerFunction: (f: File) => string;
  constructor(headerFunction: (f: File) => string) {
    super({objectMode: true});
    this.headerFunction = headerFunction;
  }
  _transform(
      file: File,
      _encoding: string,
      cb: (err?: any, data?: File) => void) {
    file.contents = Buffer.from(this.headerFunction(file) + file.contents);
    this.push(file);
    cb();
  }
}

suite('BuildBundler', () => {

  let root: string;
  let bundler;
  let bundledStream;
  let files: Map<string, File>;

  let setupTest =
      async(options: ProjectOptions) => new Promise((resolve, reject) => {
    root = options.root = options.root || defaultRoot;
    const config = new ProjectConfig(options);
    const analyzer = new BuildAnalyzer(config);
    const addHeaders = new Prepender((file) => {
      if (path.extname(file.path) === '.html') {
        return `<!-- ${path.basename(file.path)} -->`;
      }
      if (path.extname(file.path).match(/^\.(js|css)$/)) {
        return `/* ${path.basename(file.path)} */`;
      }
      return '';
    });
    bundler = new BuildBundler(config, analyzer);
    bundledStream = mergeStream(analyzer.sources(), analyzer.dependencies())
                        .pipe(addHeaders)
                        .pipe(bundler);
    bundler = new BuildBundler(config, analyzer);
    bundledStream =
        mergeStream(analyzer.sources(), analyzer.dependencies()).pipe(bundler);
    files = new Map();
    bundledStream.on('data', (file: File) => {
      files.set(file.path, file);
    });
    bundledStream.on('end', () => {
      resolve(files);
    });
    bundledStream.on('error', (err: Error) => {
      reject(err);
    });
  });

  teardown(() => {
    bundler = null;
    bundledStream = null;
    files = null;
  });

  const getFile = (filename: string) => {
    // we're getting FS paths, so add root
    const file = files.get(path.resolve(root, filename));
    return file && file.contents && file.contents.toString();
  };

  const hasMarker = (doc: ASTNode, id: string) => {
    const marker = dom5.query(
        doc,
        dom5.predicates.AND(
            dom5.predicates.hasTagName('div'),
            dom5.predicates.hasAttrValue('id', id)));
    return marker != null;
  };

  const hasImport = (doc: ASTNode, url: string) => {
    const link = dom5.query(
        doc,
        dom5.predicates.AND(
            dom5.predicates.hasTagName('link'),
            dom5.predicates.hasAttrValue('rel', 'import'),
            dom5.predicates.hasAttrValue('href', url)));
    return link != null;
  };

  test('entrypoint only', async() => {
    await setupTest({
      entrypoint: 'entrypoint-only.html',
      sources: ['framework.html', 'entrypoint-only.html'],
    });
    const doc = parse5(getFile('entrypoint-only.html'));
    assert.isTrue(hasMarker(doc, 'framework'));
    assert.isFalse(hasImport(doc, 'framework.html'));
    assert.isNotOk(getFile('shared_bundle_1.html'));
  });

  test('two fragments', async() => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      fragments: ['shell.html', 'entrypoint-a.html'],
      sources: ['shell.html', 'entrypoint-a.html', 'framework.html'],
    });

    // shell doesn't import framework
    const shellDoc = parse5(getFile('shell.html'));
    assert.isFalse(hasMarker(shellDoc, 'framework'));
    assert.isFalse(hasImport(shellDoc, 'framework.html'));

    // entrypoint doesn't import framework
    const entrypointDoc = parse5(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(entrypointDoc, 'framework'));
    assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

    // No shared-bundle bundles framework
    const sharedDoc = parse5(getFile('shared_bundle_1.html'));
    assert.isTrue(hasMarker(sharedDoc, 'framework'));
    assert.isFalse(hasImport(sharedDoc, 'framework.html'));

    // fragments import shared-bundle
    assert.isTrue(hasImport(entrypointDoc, 'shared_bundle_1.html'));
    assert.isTrue(hasImport(shellDoc, 'shared_bundle_1.html'));
  });

  // TODO(usergenic): It appears that this test is aspirational.  It wants
  // build to manipulate the entrypoint to remove things that have been bundled
  // into the shell, in this case, but we don't yet support manipulating the
  // entrypoint properly.  In part, this is because entrypoints can not have
  // relative paths, since they can be served from any url.   Note that the
  // test 'entrypoint and fragments' below is skipped for the same reason.
  test.skip('shell and entrypoint', async() => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      sources: ['framework.html', 'shell.html', 'entrypoint-a.html'],
    });

    // shell bundles framework
    const shellDoc = parse5(getFile('shell.html'));
    assert.isTrue(hasMarker(shellDoc, 'framework'));

    // entrypoint doesn't import framework
    const entrypointDoc = parse5(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(entrypointDoc, 'framework'));
    assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

    // entrypoint imports shell
    assert.isTrue(hasImport(entrypointDoc, 'shell.html'));

    // No shared-bundle with a shell
    assert.isNotOk(getFile('shared_bundle_1.html'));
  });

  test('shell and fragments with shared dependency', async() => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      fragments: ['entrypoint-b.html', 'entrypoint-c.html'],
      sources: [
        'framework.html',
        'shell.html',
        'entrypoint-a.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
        'common-dependency.html',
      ],
    });

    // shell bundles framework
    const shellDoc = parse5(getFile('shell.html'));
    assert.isTrue(hasMarker(shellDoc, 'framework'));
    assert.isFalse(hasImport(shellDoc, 'framework.html'));

    // shell bundles commonDep
    assert.isTrue(hasMarker(shellDoc, 'commonDep'));
    assert.isFalse(hasImport(shellDoc, 'common-dependency.html'));

    // entrypoint B doesn't import commonDep
    const entrypointBDoc = parse5(getFile('entrypoint-b.html'));
    assert.isFalse(hasMarker(entrypointBDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointBDoc, 'common-dependency.html'));

    // entrypoint C doesn't import commonDep
    const entrypointCDoc = parse5(getFile('entrypoint-c.html'));
    assert.isFalse(hasMarker(entrypointCDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointCDoc, 'common-dependency.html'));

    // entrypoints import shell
    assert.isTrue(hasImport(entrypointBDoc, 'shell.html'));
    assert.isTrue(hasImport(entrypointCDoc, 'shell.html'));

    // No shared-bundle with a shell
    assert.isNotOk(getFile('shared_bundle_1.html'));
  });

  // TODO(usergenic): This test is skipped for the same reason as the test
  // above called 'shell and entrypoint'.
  test.skip('entrypoint and fragments', async() => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      fragments: [
        'shell.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
      ],
      sources: [
        'framework.html',
        'shell.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
        'common-dependency.html',
      ],
    });

    // shared bundle was emitted
    const bundle = getFile('shared_bundle_1.html');
    assert.ok(bundle);
    const bundleDoc = parse5(bundle);

    // shared-bundle bundles framework
    assert.isTrue(hasMarker(bundleDoc, 'framework'));
    assert.isFalse(hasImport(bundleDoc, 'framework.html'));

    // shared-bundle bundles commonDep
    assert.isTrue(hasMarker(bundleDoc, 'commonDep'));
    assert.isFalse(hasImport(bundleDoc, 'common-dependency.html'));

    // entrypoint doesn't import framework
    const entrypointDoc = parse5(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(entrypointDoc, 'framework'));
    assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

    // shell doesn't import framework
    const shellDoc = parse5(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(shellDoc, 'framework'));
    assert.isFalse(hasImport(shellDoc, 'framework.html'));

    // entrypoint B doesn't import commonDep
    const entrypointBDoc = parse5(getFile('entrypoint-b.html'));
    assert.isFalse(hasMarker(entrypointBDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointBDoc, 'common-dependency.html'));

    // entrypoint C doesn't import commonDep
    const entrypointCDoc = parse5(getFile('entrypoint-c.html'));
    assert.isFalse(hasMarker(entrypointCDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointCDoc, 'common-dependency.html'));

    // entrypoint and fragments import shared-bundle
    assert.isTrue(hasImport(entrypointDoc, 'shared_bundle_1.html'));
    assert.isTrue(hasImport(entrypointBDoc, 'shared_bundle_1.html'));
    assert.isTrue(hasImport(entrypointCDoc, 'shared_bundle_1.html'));
    assert.isTrue(hasImport(shellDoc, 'shared_bundle_1.html'));
  });

  test('bundler loads changed files from stream', async() => {

    await setupTest({
      root: path.resolve('test-fixtures/bundle-project'),
      entrypoint: 'index.html',
      sources: [
        'index.html',
        'simple-import.html',
        'simple-import-2.html',
        'simple-style.css',
      ],
    });
    const bundledHtml = getFile('index.html');

    // In setupTest, we use a transform stream called Prepender, to prepend
    // each file with a comment including its basename before it makes it
    // into the bundler.  This verifies that bundler is processing files from
    // the stream instead of from the filesystem.
    assert.include(bundledHtml, '<!-- index.html -->');
    assert.include(bundledHtml, '<!-- simple-import.html -->');
    assert.include(bundledHtml, '<!-- simple-import-2.html -->');
    assert.include(bundledHtml, '/* simple-style.css */');
  });
});
