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

'use strict';

const assert = require('chai').assert;
const dom5 = require('dom5');
const parse5 = require('parse5');
const path = require('path');
const mergeStream = require('merge-stream');
const ProjectConfig = require('polymer-project-config').ProjectConfig;

const analyzer = require('../lib/analyzer');
const bundle = require('../lib/bundle');

const Bundler = bundle.Bundler;
const BuildAnalyzer = analyzer.BuildAnalyzer;

const root = path.resolve('test/static/bundler-data');

suite('Bundler', () => {

  let bundler;
  let bundledStream;
  let files;

  let setupTest = (options) => new Promise((resolve, reject) => {
    options.root = options.root || root;
    let config = new ProjectConfig(options);
    let analyzer = new BuildAnalyzer(config);
    bundler = new Bundler(config, analyzer);
    bundledStream =
        mergeStream(analyzer.sources, analyzer.dependencies).pipe(bundler);
    files = new Map();
    bundledStream.on('data', (file) => {
      files.set(file.path, file);
    });
    bundledStream.on('end', (data) => {
      resolve(files);
    });
    bundledStream.on('error', (err) => {
      reject(err);
    });
  });

  teardown(() => {
    bundler = null;
    bundledStream = null;
    files = null;
  });

  const getFile =
      (filename) => {
        // we're getting FS paths, so add root
        const file = files.get(path.resolve(root, filename));
        return file && file.contents && file.contents.toString();
      }

  const hasMarker = (doc, id) => {
    const marker = dom5.query(
        doc,
        dom5.predicates.AND(
            dom5.predicates.hasTagName('div'),
            dom5.predicates.hasAttrValue('id', id)));
    return marker != null;
  };

  const hasImport = (doc, url) => {
    const link = dom5.query(
        doc,
        dom5.predicates.AND(
            dom5.predicates.hasTagName('link'),
            dom5.predicates.hasAttrValue('rel', 'import'),
            dom5.predicates.hasAttrValue('href', url)));
    return link != null;
  };

  test(
      'entrypoint only',
      () => setupTest({
              entrypoint: 'entrypoint-only.html',
              sources: ['framework.html', 'entrypoint-only.html'],
            }).then((files) => {
        const doc = parse5.parse(getFile('entrypoint-only.html'));
        assert.isTrue(hasMarker(doc, 'framework'));
        assert.isFalse(hasImport(doc, 'framework.html'));
        assert.isNotOk(getFile('shared-bundle.html'));
      }));

  test(
      'two fragments',
      () => setupTest({
              entrypoint: 'entrypoint-a.html',
              fragments: ['shell.html', 'entrypoint-a.html'],
              sources: ['shell.html', 'entrypoint-a.html', 'framework.html'],
            }).then((files) => {
        // shell doesn't import framework
        const shellDoc = parse5.parse(getFile('shell.html'));
        assert.isFalse(hasMarker(shellDoc, 'framework'));
        assert.isFalse(hasImport(shellDoc, 'framework.html'));

        // entrypoint doesn't import framework
        const entrypointDoc = parse5.parse(getFile('entrypoint-a.html'));
        assert.isFalse(hasMarker(entrypointDoc, 'framework'));
        assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

        // No shared-bundle bundles framework
        const sharedDoc = parse5.parse(getFile('shared-bundle.html'));
        assert.isTrue(hasMarker(sharedDoc, 'framework'));
        assert.isFalse(hasImport(sharedDoc, 'framework.html'));

        // fragments import shared-bundle
        assert.isTrue(hasImport(entrypointDoc, 'shared-bundle.html'));
        assert.isTrue(hasImport(shellDoc, 'shared-bundle.html'));
      }));

  test.skip(
      'shell and entrypoint',
      () => setupTest({
              entrypoint: 'entrypoint-a.html',
              shell: 'shell.html',
              files: ['framework.html', 'shell.html', 'entrypoint-a.html'],
            }).then((files) => {

        // shell bundles framework
        const shellDoc = parse5.parse(getFile('shell.html'));
        assert.isTrue(hasMarker(shellDoc, 'framework'));

        // entrypoint doesn't import framework
        const entrypointDoc = parse5.parse(getFile('entrypoint-a.html'));
        assert.isFalse(hasMarker(entrypointDoc, 'framework'));
        assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

        // entrypoint imports shell
        assert.isTrue(hasImport(entrypointDoc, 'shell.html'));

        // No shared-bundle with a shell
        assert.isNotOk(getFile('shared-bundle.html'));
      }));

  test(
      'shell and fragments with shared dependency',
      () => setupTest({
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
            }).then((files) => {
        // shell bundles framework
        const shellDoc = parse5.parse(getFile('shell.html'));
        assert.isTrue(hasMarker(shellDoc, 'framework'));
        assert.isFalse(hasImport(shellDoc, 'framework.html'));

        // shell bundles commonDep
        assert.isTrue(hasMarker(shellDoc, 'commonDep'));
        assert.isFalse(hasImport(shellDoc, 'common-dependency.html'));

        // entrypoint B doesn't import commonDep
        const entrypointBDoc = parse5.parse(getFile('entrypoint-b.html'));
        assert.isFalse(hasMarker(entrypointBDoc, 'commonDep'));
        assert.isFalse(hasImport(entrypointBDoc, 'common-dependency.html'));

        // entrypoint C doesn't import commonDep
        const entrypointCDoc = parse5.parse(getFile('entrypoint-c.html'));
        assert.isFalse(hasMarker(entrypointCDoc, 'commonDep'));
        assert.isFalse(hasImport(entrypointCDoc, 'common-dependency.html'));

        // entrypoints import shell
        assert.isTrue(hasImport(entrypointBDoc, 'shell.html'));
        assert.isTrue(hasImport(entrypointCDoc, 'shell.html'));

        // No shared-bundle with a shell
        assert.isNotOk(getFile('shared-bundle.html'));
      }));

  test.skip('entrypoint and fragments', () => setupTest({
                                                entrypoint: 'entrypoint-a.html',
                                                fragments: [
                                                  'shell.html',
                                                  'entrypoint-b.html',
                                                  'entrypoint-c.html',
                                                ],
                                                files: [
                                                  'framework.html',
                                                  'shell.html',
                                                  'entrypoint-b.html',
                                                  'entrypoint-c.html',
                                                  'common-dependency.html',
                                                ],
                                              }).then((files) => {
    // shared bundle was emitted
    const bundle = getFile('shared-bundle.html');
    assert.ok(bundle);
    const bundleDoc = parse5.parse(bundle);

    // shared-bundle bundles framework
    assert.isTrue(hasMarker(bundleDoc, 'framework'));
    assert.isFalse(hasImport(bundleDoc, 'framework.html'));

    // shared-bundle bundles commonDep
    assert.isTrue(hasMarker(bundleDoc, 'common-dependency'));
    assert.isFalse(hasImport(bundleDoc, 'common-dependency.html'));

    // entrypoint doesn't import framework
    const entrypointDoc = parse5.parse(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(entrypointDoc, 'framework'));
    assert.isFalse(hasImport(entrypointDoc, 'framework.html'));

    // shell doesn't import framework
    const shellDoc = parse5.parse(getFile('entrypoint-a.html'));
    assert.isFalse(hasMarker(shellDoc, 'framework'));
    assert.isFalse(hasImport(shellDoc, 'framework.html'));

    // entrypoint B doesn't import commonDep
    const entrypointBDoc = parse5.parse(getFile('entrypoint-b.html'));
    assert.isFalse(hasMarker(entrypointBDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointBDoc, 'common-dependency.html'));

    // entrypoint C doesn't import commonDep
    const entrypointCDoc = parse5.parse(getFile('entrypoint-c.html'));
    assert.isFalse(hasMarker(entrypointCDoc, 'commonDep'));
    assert.isFalse(hasImport(entrypointCDoc, 'common-dependency.html'));

    // entrypoint and fragments import shared-bundle
    assert.isTrue(hasImport(entrypointDoc, 'shared-bundle.html'));
    assert.isTrue(hasImport(entrypointBDoc, 'shared-bundle.html'));
    assert.isTrue(hasImport(entrypointCDoc, 'shared-bundle.html'));
    assert.isTrue(hasImport(shellDoc, 'shared-bundle.html'));
  }));
});
