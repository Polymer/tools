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

import {assert} from 'chai';

import {Analyzer} from '../../core/analyzer';
import {FsUrlResolver} from '../../url-loader/fs-url-resolver';
import {IndirectUrlResolver} from '../../url-loader/indirect-url-resolver';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';
import {fileRelativeUrl, packageRelativeUrl, resolvedUrl, rootedFileUrl} from '../test-utils';

suite('IndirectUrlResolver', function() {
  const mapping = new Map<string, string>([
    ['/foo/foo.html', 'sub/package/foo/foo.html'],
    ['/foo/foo.css', 'sub/package/foo/foo.css'],
    ['/bar/bar.html', 'different/x/y/bar.html'],
    ['/bar/bar.css', 'different/x/y/bar.css'],
  ]);
  const indirectResolver =
      new IndirectUrlResolver('/root', '/root/sub/package', mapping);

  test('resolve', async () => {
    // Package relative urls are resolved relative to the package
    assert.deepEqual(
        indirectResolver.resolve(packageRelativeUrl`foo.html`),
        rootedFileUrl`root/sub/package/foo.html`);

    // Full URLs are left alone
    assert.deepEqual(
        indirectResolver.resolve(rootedFileUrl`root/sub/package/bar.html`),
        rootedFileUrl`root/sub/package/bar.html`);

    // Relative urls with a base url are resolved relative to url space
    assert.deepEqual(
        indirectResolver.resolve(
            rootedFileUrl`root/sub/package/foo/foo.html`,
            fileRelativeUrl`../bar/bar.html`),
        rootedFileUrl`root/different/x/y/bar.html`);

    // Protocol-relative urls are resolved with default https: protocol
    assert.deepEqual(
        indirectResolver.resolve(packageRelativeUrl`//foo.com/bar.html`),
        resolvedUrl`https://foo.com/bar.html`);

    // Protocol-relative urls are resolved with provided protocol
    assert.deepEqual(
        (new IndirectUrlResolver(
             '/root', '/root/sub/package', mapping, 'potato'))
            .resolve(packageRelativeUrl`//foo.com/bar.html`),
        resolvedUrl`potato://foo.com/bar.html`);
  });

  test('relative', async () => {
    // From a mapped url to a mapped known url.
    assert.deepEqual(
        indirectResolver.relative(
            rootedFileUrl`root/different/x/y/bar.html`,
            rootedFileUrl`root/sub/package/foo/foo.css`),
        `../foo/foo.css`);

    // From a mapped url to an unmapped url.
    assert.deepEqual(
        indirectResolver.relative(
            rootedFileUrl`root/different/x/y/bar.html`,
            rootedFileUrl`root/different/x/y/bar.js`),
        `bar.js`);

    // From an unmapped url to an unmapped url.
    assert.deepEqual(
        indirectResolver.relative(
            rootedFileUrl`root/another/baz.html`,
            rootedFileUrl`root/more/bonk.html`),
        `../more/bonk.html`);
  });

  suite('integration', () => {
    const testName = `handles resolving urls with a full mapping from deep ` +
        `subdirs into a flatter runtime url space`;
    test(testName, async () => {
      const fsUrlResolver = new FsUrlResolver('/root');
      const overlayLoader = new InMemoryOverlayUrlLoader();
      overlayLoader.urlContentsMap.set(
          fsUrlResolver.resolve(packageRelativeUrl`sub/package/foo/foo.html`)!,
          `
        <link rel="import" href="../bar/bar.html">
        <link rel="stylesheet" href="foo.css">
      `);
      overlayLoader.urlContentsMap.set(
          fsUrlResolver.resolve(packageRelativeUrl`sub/package/foo/foo.css`)!,
          ``);
      overlayLoader.urlContentsMap.set(
          fsUrlResolver.resolve(packageRelativeUrl`different/x/y/bar.html`)!, `
        <link rel="stylesheet" href="./bar.css">
      `);
      overlayLoader.urlContentsMap.set(
          fsUrlResolver.resolve(packageRelativeUrl`different/x/y/bar.css`)!,
          ``);
      const analyzer = new Analyzer(
          {urlLoader: overlayLoader, urlResolver: indirectResolver});
      const analysis = await analyzer.analyze(['foo/foo.html']);
      assert.deepEqual(
          analysis.getWarnings().map(
              (w) => w.toString({verbosity: 'code-only'})),
          []);
      const documents = analysis.getFeatures({kind: 'document'});
      assert.deepEqual([...documents].map((d) => d.url), [
        rootedFileUrl`root/sub/package/foo/foo.html`,
        rootedFileUrl`root/different/x/y/bar.html`,
        rootedFileUrl`root/different/x/y/bar.css`,
        rootedFileUrl`root/sub/package/foo/foo.css`
      ]);
      const imports = analysis.getFeatures({kind: 'import'});
      assert.deepEqual(
          [...imports].map((i) => i.originalUrl),
          ['../bar/bar.html', './bar.css', 'foo.css']);
      assert.deepEqual([...imports].map((i) => i.url), [
        rootedFileUrl`root/different/x/y/bar.html`,
        rootedFileUrl`root/different/x/y/bar.css`,
        rootedFileUrl`root/sub/package/foo/foo.css`
      ]);
    });
  });
});
