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
import {Bundle} from 'polymer-bundler/lib/bundle-manifest';
import {ProjectConfig, ProjectOptions} from 'polymer-project-config';

import File = require('vinyl');
import * as dom5 from 'dom5';
import {ASTNode, parse as parse5} from 'parse5';
import * as path from 'path';
import {Stream} from 'stream';
const mergeStream = require('merge-stream');

import {BuildAnalyzer} from '../analyzer';
import {BuildBundler, Options as BuildBundlerOptions} from '../bundle';
import {AsyncTransformStream} from '../streams';

const defaultRoot = path.resolve('test-fixtures/bundler-data');

class FileTransform extends AsyncTransformStream<File, {}> {
  transform: (s: FileTransform, f: File) => void;
  constructor(transform: (s: FileTransform, f: File) => void) {
    super({objectMode: true});
    this.transform = transform;
  }
  protected async *
      _transformIter(files: AsyncIterable<File>): AsyncIterable<{}> {
    for await (const file of files) {
      this.transform(this, file.clone());
    }
  }
}

suite('BuildBundler', () => {

  let root: string;
  let bundler: BuildBundler;
  let bundledStream: Stream;
  let files: Map<string, File>;

  const setupTest = async (
      projectOptions: ProjectOptions,
      bundlerOptions?: BuildBundlerOptions,
      transform?: FileTransform) => new Promise((resolve, reject) => {

    assert.isDefined(projectOptions.root);
    root = projectOptions.root;
    const config = new ProjectConfig(projectOptions);
    const analyzer = new BuildAnalyzer(config);

    bundler = new BuildBundler(config, analyzer, bundlerOptions);
    bundledStream = mergeStream(analyzer.sources(), analyzer.dependencies());
    if (transform) {
      bundledStream = bundledStream.pipe(transform);
    }
    bundledStream = bundledStream.pipe(bundler);
    bundler = new BuildBundler(config, analyzer);
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

  const addHeaders = new FileTransform((stream, file) => {
    if (path.extname(file.path) === '.html') {
      file.contents =
          new Buffer(`<!-- ${path.basename(file.path)} -->${file.contents}`);
    } else if (path.extname(file.path).match(/^\.(js|css)$/)) {
      file.contents =
          new Buffer(`/* ${path.basename(file.path)} */${file.contents}`);
    }
    stream.push(file);
  });

  test('entrypoint only', async () => {
    await setupTest({
      root: defaultRoot,
      entrypoint: 'entrypoint-only.html',
    });
    const doc = parse5(getFile('entrypoint-only.html'));
    assert.isTrue(hasMarker(doc, 'framework'), 'has framework');
    assert.isFalse(hasImport(doc, 'framework.html'));
    assert.isNotOk(getFile('shared_bundle_1.html'));
  });

  test('two fragments', async () => {
    await setupTest({
      root: defaultRoot,
      entrypoint: 'entrypoint-a.html',
      fragments: ['shell.html', 'entrypoint-a.html'],
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
  test.skip('shell and entrypoint', async () => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
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

  test('shell and fragments with shared dependency', async () => {
    await setupTest({
      root: defaultRoot,
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      fragments: ['entrypoint-b.html', 'entrypoint-c.html'],
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

    // entrypoints don't import shell
    assert.isFalse(hasImport(entrypointBDoc, 'shell.html'));
    assert.isFalse(hasImport(entrypointCDoc, 'shell.html'));

    // No shared-bundle with a shell
    assert.isNotOk(getFile('shared_bundle_1.html'));
  });

  // TODO(usergenic): This test is skipped for the same reason as the test
  // above called 'shell and entrypoint'.
  test.skip('entrypoint and fragments', async () => {
    await setupTest({
      entrypoint: 'entrypoint-a.html',
      fragments: [
        'shell.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
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

  test('bundler loads changed files from stream', async () => {
    await setupTest(
        {
          root: path.resolve('test-fixtures/bundle-project'),
          entrypoint: 'index.html',
        },
        {},
        addHeaders);

    const bundledHtml = getFile('index.html');

    // In setupTest, we use a transform stream that to prepends
    // each file with a comment including its basename before it makes it
    // into the bundler.  This verifies that bundler is processing files from
    // the stream instead of from the filesystem.
    assert.include(bundledHtml, '<!-- index.html -->');
    assert.include(bundledHtml, '<!-- simple-import.html -->');
    assert.include(bundledHtml, '<!-- simple-import-2.html -->');
    assert.include(bundledHtml, '/* simple-style.css */');
  });

  test('bundler deals with win32 platform separators on win32', async () => {
    const platformSepPaths = new FileTransform((stream, file) => {
      if (path.sep === '\\') {
        file.path = file.path.replace(/\//g, path.sep);
      }
      stream.push(file);
    });
    await setupTest(
        {
          root: path.resolve('test-fixtures/bundle-project'),
          entrypoint: 'index.html',
        },
        {},
        platformSepPaths);

    const bundledHtml = getFile('index.html');

    // In setupTest, we use a transform stream that forces the file paths to
    // be in the original platform form (this only changes/matters for win32)
    // and it verifies that bundler can process files that may be merged in
    // or have otherwise reverted form paths in win32 separator form.
    assert.include(bundledHtml, '<title>Sample Build</title>', 'index.html');
    assert.include(
        bundledHtml, '<dom-module id="my-element">', 'simple-import.html');
    assert.include(
        bundledHtml, '<dom-module id="my-element-2">', 'simple-import-2.html');
    assert.include(bundledHtml, '.simply-red', 'simple-style.css');
  });

  test('bundler deals with posix platform separators on win32', async () => {
    const posixSepPaths = new FileTransform((stream, file) => {
      if (path.sep === '\\') {
        file.path = file.path.replace(/\\/g, '/');
      }
      stream.push(file);
    });
    await setupTest(
        {
          root: path.resolve('test-fixtures/bundle-project'),
          entrypoint: 'index.html'
        },
        {},
        posixSepPaths);

    const bundledHtml = getFile('index.html');

    // In setupTest, we use a transform stream that forces the file paths to
    // be in the posix form (this only changes/matters for win32)
    // and it verifies that bundler can process files that may be merged in
    // or have otherwise have paths in posix separator form.
    assert.include(bundledHtml, '<title>Sample Build</title>', 'index.html');
    assert.include(
        bundledHtml, '<dom-module id="my-element">', 'simple-import.html');
    assert.include(
        bundledHtml, '<dom-module id="my-element-2">', 'simple-import-2.html');
    assert.include(bundledHtml, '.simply-red', 'simple-style.css');
  });

  test('bundler does not output inlined html imports', async () => {
    await setupTest({root: defaultRoot, entrypoint: 'entrypoint-only.html'});
    // We should have an entrypoint-only.html file (bundled).
    assert.isOk(getFile('entrypoint-only.html'));
    // We should not have the inlined file in the output.
    assert.isNotOk(getFile('framework.html'));
  });

  test('bundler outputs html imports that are not inlined', async () => {
    await setupTest(
        {root: defaultRoot, entrypoint: 'entrypoint-only.html'},
        {excludes: ['framework.html']});
    // We should have an entrypoint-only.html file (bundled).
    assert.isOk(getFile('entrypoint-only.html'));
    // We should have the html import that was excluded from inlining.
    assert.isOk(getFile('framework.html'));
  });

  test('bundler does not output inlined scripts or styles', async () => {
    await setupTest({
      root: path.resolve('test-fixtures/bundle-project'),
      entrypoint: 'index.html',
    });
    assert.deepEqual(
        [...files.keys()].sort(),
        [path.resolve('test-fixtures/bundle-project/index.html')]);
  });

  test('bundler does output scripts and styles not inlined', async () => {
    await setupTest(
        {
          root: path.resolve('test-fixtures/bundle-project'),
          entrypoint: 'index.html',
        },
        {
          inlineCss: false,
          inlineScripts: false,
        });
    assert.deepEqual([...files.keys()].sort(), [
      'test-fixtures/bundle-project/index.html',
      'test-fixtures/bundle-project/simple-script.js',
      'test-fixtures/bundle-project/simple-style.css'
    ].map((p) => path.resolve(p)));
  });

  suite('options', () => {

    const projectOptions = {
      root: 'test-fixtures/test-project',
      entrypoint: 'index.html',
      fragments: ['shell.html'],
    };

    test('excludes: html file urls listed are not inlined', async () => {
      await setupTest(
          projectOptions,
          {excludes: ['bower_components/loads-external-dependencies.html']});
      assert.isOk(
          getFile('bower_components/loads-external-dependencies.html'),
          'Excluded import is passed through the bundler');
      assert.include(
          getFile('shell.html'),
          '<link rel="import" href="bower_components/loads-external-dependencies.html">');
    });

    // TODO(usergenic): Uncomment this test after bundler's next release, which
    // includes the fix for folder references in excludes.
    test.skip('excludes: html files in folders listed are not inlined', async () => {
      await setupTest(projectOptions, {excludes: ['bower_components/']});
      assert.isOk(
          getFile('bower_components/loads-external-dependencies.html'),
          'Excluded import is passed through the bundler');
      assert.include(
          getFile('shell.html'),
          '<link rel="import" href="bower_components/loads-external-dependencies.html">');
    });

    test('excludes: nothing is excluded when no excludes are given', async () => {
      await setupTest(projectOptions, {excludes: []});
      assert.isNotOk(
          getFile('bower_components/loads-external-dependencies.html'),
          'Inlined imports are not passed through the bundler');
      assert.notInclude(
          getFile('shell.html'),
          '<link rel="import" href="bower_components/loads-external-dependencies.html">');
      assert.include(
          getFile('shell.html'),
          '<script src="https://www.example.com/script.js">',
          'Inlined import content');
    });

    test('inlineCss: false, does not inline external stylesheets', async () => {
      await setupTest(projectOptions, {inlineCss: false});
      assert.notInclude(getFile('shell.html'), '.test-project-style');
    });

    test('inlineCss: true, inlines external stylesheets', async () => {
      await setupTest(projectOptions, {inlineCss: true});
      assert.include(getFile('shell.html'), '.test-project-style');
    });

    test('inlineScripts: false, does not inline external scripts', async () => {
      await setupTest(projectOptions, {inlineScripts: false});
      assert.notInclude(getFile('shell.html'), 'console.log(\'shell\')');
    });

    test('inlineScripts: true, inlines external scripts', async () => {
      await setupTest(projectOptions, {inlineScripts: true});
      assert.include(getFile('shell.html'), 'console.log(\'shell\')');
    });

    test('stripComments: false, does not strip html comments', async () => {
      await setupTest(projectOptions, {stripComments: false});
      assert.include(
          getFile('shell.html'),
          '<!-- remote dependencies should be ignored during build -->');
    });

    test('stripComments: true, strips html comments', async () => {
      await setupTest(projectOptions, {stripComments: true});
      assert.notInclude(
          getFile('shell.html'),
          '<!-- remote dependencies should be ignored during build -->');
    });

    test('strategy: fn(), applies bundle strategy function', async () => {
      await setupTest(projectOptions, {
        // Custom strategy creates a separate bundle for everything in the
        // `bower_components` folder.
        strategy: (bundles) => {
          const bowerBundle = new Bundle();
          bundles.forEach((bundle) => {
            bundle.files.forEach((file) => {
              if (file.includes('bower_components')) {
                bowerBundle.files.add(file);
                bundle.files.delete(file);
              }
            });
          });
          return bundles.concat(bowerBundle);
        }
      });
      assert.isOk(getFile('shared_bundle_1.html'));
      assert.include(getFile('shared_bundle_1.html'), '<div id="dep"></div>');
    });

    test('urlMapper: fn(), applies bundle url mapper function', async () => {
      await setupTest(projectOptions, {
        urlMapper: (bundles) => {
          const map = new Map<string, Bundle>();
          for (const bundle of bundles) {
            map.set(`bundled/${Array.from(bundle.entrypoints)}`, bundle);
          }
          return map;
        }
      });
      assert.isOk(getFile('bundled/shell.html'));
    });
  });
});
