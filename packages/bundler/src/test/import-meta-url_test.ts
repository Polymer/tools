/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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
import * as babel from 'babel-types';
import {assert} from 'chai';
import {Bundle} from 'magic-string';
import {PackageRelativeUrl} from 'polymer-analyzer';

import {Bundler} from '../bundler';

import {heredoc, inMemoryAnalyzer} from './test-utils';

suite('import.meta.url', () => {

  const analyzer = inMemoryAnalyzer({
    'a.js': `
      const myUrl = import.meta.url;
      export {myUrl};
    `,
    'subfolder/b.js': `
      import {myUrl as aUrl} from '../a.js';
      const myUrl = import.meta.url;
      export {myUrl, aUrl};
    `,
    'c.js': `
      import {aUrl, myUrl as bUrl} from './subfolder/b.js';
      const myMeta = import.meta;
      export {aUrl, bUrl, myMeta};
    `,
  });

  const aUrl = analyzer.resolveUrl('a.js')!;
  const bUrl = analyzer.resolveUrl('subfolder/b.js')!;
  const cUrl = analyzer.resolveUrl('c.js')!;
  const dUrl = analyzer.resolveUrl('d.js')!;

  test('bundled module with same URL as bundle', async () => {
    const bundler = new Bundler({analyzer});
    const aDoc = (await analyzer.analyze([aUrl])).getDocument(aUrl)!;
    const {documents} =
        await bundler.bundle(await bundler.generateManifest([aUrl]));
    assert.deepEqual(documents.get(aUrl)!.content, heredoc`
        const myUrl = import.meta.url;
        var a = {
          myUrl: myUrl
        };
        export { a as $a, myUrl };`);
  });

  test('corrected import.meta.url for bundled import', async () => {
    const bundler = new Bundler({analyzer});
    const {documents} =
        await bundler.bundle(await bundler.generateManifest([bUrl]));
    assert.deepEqual(documents.get(bUrl)!.content, heredoc`
      const __bundledImportMeta = { ...import.meta,
        url: new URL('../a.js', import.meta.url)
      };
      const myUrl = __bundledImportMeta.url;
      var a = {
        myUrl: myUrl
      };
      const myUrl$1 = import.meta.url;
      var b = {
        myUrl: myUrl$1,
        aUrl: myUrl
      };
      export { a as $a, b as $b, myUrl as myUrl$1, myUrl$1 as myUrl, myUrl as aUrl };`);
  });

  test('multiple corrected import.meta.url values', async () => {
    const bundler = new Bundler({analyzer});
    const {documents} =
        await bundler.bundle(await bundler.generateManifest([cUrl]));
    assert.deepEqual(documents.get(cUrl)!.content, heredoc`
      const __bundledImportMeta = { ...import.meta,
        url: new URL('./a.js', import.meta.url)
      };
      const myUrl = __bundledImportMeta.url;
      var a = {
        myUrl: myUrl
      };
      const __bundledImportMeta$1 = { ...import.meta,
        url: new URL('./subfolder/b.js', import.meta.url)
      };
      const myUrl$1 = __bundledImportMeta$1.url;
      var b = {
        myUrl: myUrl$1,
        aUrl: myUrl
      };
      const myMeta = import.meta;
      var c = {
        aUrl: myUrl,
        bUrl: myUrl$1,
        myMeta: myMeta
      };
      export { a as $a, c as $c, b as $b, myUrl, myUrl as aUrl, myUrl$1 as bUrl, myMeta, myUrl$1, myUrl as aUrl$1 };`);
  });
});
