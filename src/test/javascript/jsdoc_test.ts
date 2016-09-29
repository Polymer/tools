/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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

import * as jsdoc from '../../javascript/jsdoc.js';

suite('jsdoc', function() {
  suite('.parseJsdoc', function() {
    test('parses single-line', function() {
      const parsed = jsdoc.parseJsdoc('* Just some text');
      assert.deepEqual(parsed, {
        description: 'Just some text',
        tags: [],
      });
    });

    test('parses body-only', function() {
      const parsed = jsdoc.parseJsdoc('* Just some text\n* in multiple lines.');
      assert.deepEqual(parsed, {
        description: 'Just some text\nin multiple lines.',
        tags: [],
      });
    });

    test('parses tag-only', function() {
      const parsed = jsdoc.parseJsdoc('* @atag');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {tag: 'atag', description: null, name: null, type: null},
        ],
      });
    });

    test('parses tag-name', function() {
      const parsed = jsdoc.parseJsdoc('* @do stuff');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {tag: 'do', description: 'stuff', name: null, type: null},
        ],
      });
    });

    test('parses tag-desc', function() {
      const parsed = jsdoc.parseJsdoc('* @do a thing');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {tag: 'do', description: 'a thing', name: null, type: null},
        ],
      });
    });

    test('parses param type', function() {
      const parsed = jsdoc.parseJsdoc('* @param {Type} name desc desc');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {tag: 'param', type: 'Type', name: 'name', description: 'desc desc'},
        ],
      });
    });

    test('preserves indentation for the body', function() {
      const parsed = jsdoc.parseJsdoc('*     The desc.\n*     thing');
      assert.deepEqual(parsed.description, '    The desc.\n    thing');
    });

    test('handles empty lines', function() {
      const parsed = jsdoc.parseJsdoc('*\n *\n * Foo\n   *\n * Bar');
      assert.deepEqual(parsed.description, '\n\nFoo\n\nBar');
    });

  });

});
