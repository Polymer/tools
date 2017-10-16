/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import {generateDeclarations} from '../gen-ts';

const fixtures = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const goldens = path.join(__dirname, '..', '..', 'src', 'test', 'goldens');

suite('generateDeclarations', () => {
  for (const fixture of fs.readdirSync(goldens)) {
    test(fixture, async () => {
      const golden =
          fs.readFileSync(path.join(goldens, fixture, 'expected.d.ts'));
      const declarations =
          await generateDeclarations(path.join(fixtures, fixture));
      assert.equal(declarations, golden.toString());
    }).timeout(30000);  // These tests can take a long time.
  }
});
