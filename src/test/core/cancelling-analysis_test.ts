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


import {CancelToken} from 'cancel-token';

import {createForDirectory, fixtureDir} from '../test-utils';

suite('cancelling analysis midway through', () => {
  test(`analyze() does not complete when cancelled`, async () => {
    const {analyzer} = await createForDirectory(fixtureDir);
    const cancelSource = CancelToken.source();

    const analysisPromise = analyzer.analyze(
        ['vanilla-elements.js'], {cancelToken: cancelSource.token});
    cancelSource.cancel();
    const analysis = await analysisPromise;
    const result = analysis.getDocument('vanilla-element.js');
    if (result.successful) {
      throw new Error(`Did not expect analysis to succeed when cancelled.`);
    }
  });

  test('we can handle parallel requests, one canceled one not', async () => {
    const {analyzer} = await createForDirectory(fixtureDir);
    const cancelSource = CancelToken.source();
    const url = 'vanilla-elements.js';
    const cancelledAnalysisPromise =
        analyzer.analyze([url], {cancelToken: cancelSource.token});
    const goodAnalysisPromise = analyzer.analyze([url]);
    cancelSource.cancel();
    const cancelledAnalysis = await cancelledAnalysisPromise;
    const cancelledResult = cancelledAnalysis.getDocument(url);
    if (cancelledResult.successful) {
      throw new Error(`Expected cancelled analysis not to yield a document.`);
    }
    const goodAnalysis = await goodAnalysisPromise;
    const goodResult = goodAnalysis.getDocument(url);
    if (!goodResult.successful) {
      throw new Error(`Expected non-cancelled analysis to yield a document.`);
    }
  });
});
