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

import {ScannedFeature, Warning} from '../../model/model';
import {ParsedDocument} from '../../parser/document';
import {scan} from '../../scanning/scan';
import {Scanner} from '../../scanning/scanner';
import {invertPromise} from '../test-utils';

suite('scan()', () => {
  test('calls Scanner.scan', async () => {
    const feature = Symbol('feature') as any;
    const scanner = new ScannerStub(<any>[feature]);
    const document = makeTestDocument({});

    const {features} = await scan(document, [scanner]);
    assert.deepEqual(features, [feature]);
    assert.deepEqual(scanner.calls, [{document}]);
    assert.deepEqual(features, [feature]);
  });

  test('supports multiple and async calls to visit()', async () => {
    const visitor1 = Symbol('visitor1');
    const visitor2 = Symbol('visitor2');
    const visitor3 = Symbol('visitor3');
    const scanner: Scanner<any, any, any> = {
      async scan(_: ParsedDocument, visit: (visitor: any) => Promise<void>) {
        // two visitors in one batch
        await Promise.all([visit(visitor1), visit(visitor2)]);

        // one visitor in a subsequent batch, delayed a turn to make sure
        // we can call visit() truly async
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            visit(visitor3).then(resolve);
          }, 0);
        });

        return {features: [`a feature` as any], warnings: []};
      },
    };
    const visitedVisitors: any[] = [];
    const document = makeTestDocument({
      async visit(visitors: any) {
        visitedVisitors.push.apply(visitedVisitors, visitors);
      }
    });

    const {features} = await scan(document, [scanner]);
    assert.deepEqual([`a feature` as any], features);
    assert.deepEqual(visitedVisitors, [visitor1, visitor2, visitor3]);
  });

  test('propagates exceptions in scanners', () => {
    const scanner = {
      scan(_doc: any, _visit: any) {
        throw new Error('expected');
      },
    };
    return invertPromise(scan(makeTestDocument({}), <any>[scanner]));
  });

  test('propagates exceptions in visitors', () => {
    const document: any = makeTestDocument({
      visit: (): void => {
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
       visit: (visitor: any) => Promise<void>) =>
          Promise<{features: any[], warnings: Warning[]}>;
}
function makeTestScanner(options: TestScannerMakerOptions):
    Scanner<ParsedDocument<string, any>, any, any> {
  const simpleScan = (async (_doc: any, visit: () => Promise<any>) => {
    await visit();
    return {features: ['test-feature'], warnings: []};
  });
  return {scan: options.scan || simpleScan} as any;
}

/**
 * Scanner that always returns the given features and tracks when
 * scan is called.
 */
class ScannerStub implements Scanner<any, any, any> {
  calls: {document: ParsedDocument}[];
  features: ScannedFeature[];
  constructor(features: ScannedFeature[]) {
    this.features = features;
    this.calls = [];
  }

  async scan(document: ParsedDocument<any, any>, _visit: any) {
    this.calls.push({document});
    return {features: this.features, warnings: []};
  }
}
