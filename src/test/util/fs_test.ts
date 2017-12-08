/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import * as path from 'path';
import * as fsUtil from '../../util/fs';

const knownDirectoryPath = __dirname;
const knownFilePath = __filename;
const knownDoesNotExistPath = path.join(__dirname, 'AI92J53002GKGNFIAWNF');

suite('src/util/fs', () => {
  suite('existsSync()', () => {
    test('returns true if something exists at path', async () => {
      assert.isTrue(fsUtil.existsSync(knownDirectoryPath));
      assert.isTrue(fsUtil.existsSync(knownFilePath));
    });

    test('returns false if directory does not exist', async () => {
      assert.isFalse(fsUtil.existsSync(knownDoesNotExistPath));
    });
  });

  suite('isDirSync()', () => {
    test('returns true if path is a directory', async () => {
      assert.isTrue(fsUtil.isDirSync(knownDirectoryPath));
    });
    test('returns false if path is a file', async () => {
      assert.isFalse(fsUtil.isDirSync(knownFilePath));
    });
    test('returns false if nothing exists at path', async () => {
      assert.isFalse(fsUtil.isDirSync(knownDoesNotExistPath));
    });
  });
});
