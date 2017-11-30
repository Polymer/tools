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
import * as doctrine from 'doctrine';

import * as jsdoc from '../../javascript/jsdoc.js';
import {Privacy} from '../../model/model';

suite('jsdoc', () => {
  suite('parseJsdoc', () => {
    test('parses single-line', () => {
      const parsed = jsdoc.parseJsdoc('* Just some text');
      assert.deepEqual(parsed, {
        description: 'Just some text',
        tags: [],
      });
    });

    test('parses body-only', () => {
      const parsed = jsdoc.parseJsdoc('* Just some text\n* in multiple lines.');
      assert.deepEqual(parsed, {
        description: 'Just some text\nin multiple lines.',
        tags: [],
      });
    });

    test('parses tag-only', () => {
      const parsed = jsdoc.parseJsdoc('* @atag');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {title: 'atag', description: null},
        ],
      });
    });

    test('parses tag-name', () => {
      const parsed = jsdoc.parseJsdoc('* @do stuff');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {title: 'do', description: 'stuff'},
        ],
      });
    });

    test('parses tag-desc', () => {
      const parsed = jsdoc.parseJsdoc('* @do a thing');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {title: 'do', description: 'a thing'},
        ],
      });
    });

    test('parses param type', () => {
      const parsed = jsdoc.parseJsdoc('* @param {Type} name desc desc');
      assert.deepEqual(parsed, {
        description: '',
        tags: [
          {
            title: 'param',
            type: {type: 'NameExpression', name: 'Type'} as
                doctrine.type.NameExpression,
            name: 'name',
            description: 'desc desc',
          },
        ],
      });
    });

    test('preserves indentation for the body', () => {
      const parsed = jsdoc.parseJsdoc('*     The desc.\n*     thing');
      assert.deepEqual(parsed.description, '    The desc.\n    thing');
    });

    test('handles empty lines', () => {
      const parsed = jsdoc.parseJsdoc('*\n *\n * Foo\n   *\n * Bar');
      assert.deepEqual(parsed.description, 'Foo\n\nBar');
    });
  });

  suite('getPrivacy', () => {
    test('returns undefined for undefined annotation', () => {
      assert.isUndefined(jsdoc.getPrivacy(undefined));
    });

    test('returns undefined for empty tags', () => {
      assert.isUndefined(jsdoc.getPrivacy({description: '', tags: []}));
    });

    test('returns public for @public', () => {
      assert.equal(
          jsdoc.getPrivacy({
            description: '',
            tags: [{
              title: 'public',
              description: '',
            }]
          }),
          'public' as Privacy);
    });

    test('returns protected for @protected', () => {
      assert.equal(
          jsdoc.getPrivacy({
            description: '',
            tags: [{
              title: 'protected',
              description: '',
            }]
          }),
          'protected' as Privacy);
    });

    test('returns private for @private', () => {
      assert.equal(
          jsdoc.getPrivacy({
            description: '',
            tags: [{
              title: 'private',
              description: '',
            }]
          }),
          // NOTE: This cast is necessary because of a crashing bug in tsc
          'private' as Privacy);
    });
  });

  suite('isAnnotationEmpty', () => {
    test('returns true for undefined', () => {
      assert.isTrue(jsdoc.isAnnotationEmpty(undefined));
    });

    test('returns true for no tags, no description', () => {
      assert.isTrue(jsdoc.isAnnotationEmpty({description: ' \t', tags: []}));
    });

    test('returns false for a description', () => {
      assert.isFalse(jsdoc.isAnnotationEmpty({description: 'foo', tags: []}));
    });
  });
});
