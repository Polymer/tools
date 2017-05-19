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
import {AsyncTransformStream} from '../streams';

suite('AsyncTransformStream', () => {
  test('transforms input', async () => {
    class DoubleTransformer extends AsyncTransformStream<number, number> {
      protected async *
          _transformIter(inputs: AsyncIterable<number>): AsyncIterable<number> {
        for await (const input of inputs) {
          yield input * 2;
        }
      }
    }
    const transformer = new DoubleTransformer({objectMode: true});

    const results: number[] = [];
    transformer.on('data', (v: number) => results.push(v));
    const result = new Promise<number[]>((resolve, reject) => {
      transformer.on('end', () => resolve(results));
      transformer.on('error', (err: any) => reject(err));
    });
    transformer.write(10);
    transformer.write(20);
    transformer.write(30);
    transformer.end();

    const final = await result;
    assert.deepEqual(final, [20, 40, 60]);
  });

  test('fails if the stream does not consume all input', async () => {
    class GivesUpAfterTwo extends AsyncTransformStream<number, number> {
      protected async *
          _transformIter(inputs: AsyncIterable<number>): AsyncIterable<number> {
        let i = 0;
        for await (const input of inputs) {
          i++;
          if (i > 2) {
            return;
          }
          yield input * 3;
        }
      }
    }
    const transformer = new GivesUpAfterTwo({objectMode: true});

    const results: number[] = [];
    transformer.on('data', (v: number) => results.push(v));
    const onEnd = new Promise((resolve) => transformer.once('end', resolve));
    const onError =
        new Promise<Error>((resolve) => transformer.once('error', resolve));
    transformer.write(10);
    transformer.write(20);
    transformer.write(30);
    transformer.end();

    assert.deepEqual(
        (await onError).message,
        'GivesUpAfterTwo did not consume all input while transforming.');
    await onEnd;
    // We still do emit the two.
    assert.deepEqual(results, [30, 60]);
  });
});
