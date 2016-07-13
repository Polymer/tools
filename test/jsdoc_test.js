/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

"use strict";

var jsdoc;

try {
  // in browserify
  jsdoc = require('hydrolysis').jsdoc;
} catch (e) {
  // in node
  jsdoc = require('../lib/ast-utils/jsdoc.js');
}

try {
  // we're in node, we need to explicity require `expect`
  var expect = require('chai').expect;
} catch (e) {
  // `expect` is magically provided by wct, yay!
}

suite('jsdoc', function() {

  suite('.parseJsdoc', function() {

    test('parses single-line', function() {
      var parsed = jsdoc.parseJsdoc('* Just some text');
      expect(parsed).to.deep.eq({
        description: 'Just some text',
        tags: [],
      });
    });

    test('parses body-only', function() {
      var parsed = jsdoc.parseJsdoc('* Just some text\n* in multiple lines.');
      expect(parsed).to.deep.eq({
        description: 'Just some text\nin multiple lines.',
        tags: [],
      });
    });

    test('parses tag-only', function() {
      var parsed = jsdoc.parseJsdoc('* @atag');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'atag', description: null, name: undefined, type: null},
        ],
      });
    });

    test('parses tag-name', function() {
      var parsed = jsdoc.parseJsdoc('* @do stuff');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'do', description: 'stuff', name: undefined, type: null},
        ],
      });
    });

    test('parses tag-desc', function() {
      var parsed = jsdoc.parseJsdoc('* @do a thing');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'do', description: 'a thing', name: undefined, type: null},
        ],
      });
    });

    test('parses param type', function() {
      var parsed = jsdoc.parseJsdoc('* @param {Type} name desc desc');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'param', type: "Type", name: 'name', description: 'desc desc'},
        ],
      });
    });

    test('preserves indentation for the body', function() {
      var parsed = jsdoc.parseJsdoc('*     The desc.\n*     thing');
      expect(parsed.description).to.deep.eq('    The desc.\n    thing');
    });

    test('handles empty lines', function() {
      var parsed = jsdoc.parseJsdoc('*\n *\n * Foo\n   *\n * Bar');
      expect(parsed.description).to.eq('\n\nFoo\n\nBar');
    });

  });

});
