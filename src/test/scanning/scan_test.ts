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

import {ScannedFeature} from '../../model/feature';
import {ParsedDocument} from '../../parser/document';
import {scan} from '../../scanning/scan';
import {Scanner} from '../../scanning/scanner';
import {invertPromise} from '../test-utils';

suite('scan()', () => {

  test('calls Scanner.scan', async() => {
    let feature = Symbol('feature');
    let scanner = new ScannerStub(<any>[feature]);
    let document = makeTestDocument({});

    const features = await scan(document, [scanner]);
    assert.deepEqual(features, [feature]);
    assert.deepEqual(scanner.calls, [{document}]);
    assert.deepEqual(features, [feature]);
  });

  test('supports multiple and async calls to visit()', async() => {
    let visitor1 = Symbol('visitor1');
    let visitor2 = Symbol('visitor2');
    let visitor3 = Symbol('visitor3');
    let scanner: Scanner<any, any, any> = {
      async scan(
          _: ParsedDocument<any, any>, visit: (visitor: any) => Promise<void>) {
        // two visitors in one batch
        await Promise.all([visit(visitor1), visit(visitor2)]);

        // one visitor in a subsequent batch, delayed a turn to make sure
        // we can call visit() truly async
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            visit(visitor3).then(resolve);
          }, 0);
        });

        return [`a feature` as any];
      },
    };
    let visitedVisitors: any[] = [];
    let document = makeTestDocument({
      async visit(visitors: any) {
        visitedVisitors.push.apply(visitedVisitors, visitors);
      }
    });

    const features = await scan(document, [scanner]);
    assert.deepEqual([`a feature`], features);
    assert.deepEqual(visitedVisitors, [visitor1, visitor2, visitor3]);
  });

  test('propagates exceptions in scanners', () => {
    let scanner = {
      scan(_doc: any, _visit: any) {
        throw new Error('expected');
      },
    };
    return invertPromise(scan(makeTestDocument({}), <any>[scanner]));
  });

  test('propagates exceptions in visitors', () => {
    let document: any = makeTestDocument({
      visit: (): Promise<any> => {
        throw new Error('expected');
      },
    });
    return invertPromise(scan(document, [makeTestScanner({})]));
  });

});

interface TestDocumentMakerOptions {
  forEachNode?: (callback: (node: any) => void) => void;
  visit?: (visitors: any[]) => void;
  type?: string;
  contents?: string;
  ast?: string;
  url?: string;
}
function makeTestDocument(options: TestDocumentMakerOptions):
    ParsedDocument<string, any> {
  return {
    type: options.type || 'test-type',
    contents: options.contents || 'test-contents',
    ast: options.ast || 'test-ast',
    url: options.url || 'test-url',
    visit: options.visit || (() => null),
    forEachNode: options.forEachNode || (() => null),
    sourceRangeForNode: () => {
      throw new Error('not implemented in test doc');
    },
    stringify() {
      return 'test stringify output';
    }
  } as any;
}

interface TestScannerMakerOptions {
  scan?:
      (document: ParsedDocument<string, any>,
       visit: (visitor: any) => Promise<void>) => Promise<any[]>;
}
function makeTestScanner(options: TestScannerMakerOptions):
    Scanner<ParsedDocument<string, any>, any, any> {
  const simpleScan = (async(_doc: any, visit: () => Promise<any>) => {
    await visit();
    return ['test-feature'];
  });
  return {scan: options.scan || simpleScan};
}

/**
 * Scanner that always returns the given features and tracks when
 * scan is called.
 */
class ScannerStub implements Scanner<any, any, any> {
  calls: {document: ParsedDocument<any, any>}[];
  features: ScannedFeature[];
  constructor(features: ScannedFeature[]) {
    this.features = features;
    this.calls = [];
  }

  async scan(document: ParsedDocument<any, any>, _visit: any) {
    this.calls.push({document});
    return this.features;
  }
}
