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

import * as babel from '@babel/types';
import * as babylon from 'babylon';
import {parse} from 'babylon';
import {assert} from 'chai';

import {getEventComments, getPropertyName, getSimpleObjectProperties} from '../../javascript/esutil';


suite('getEventComments', () => {
  test('returns events from a comment', () => {
    const node = parse(`
        class Foo {
          /**
           * This is an event
           *
           * @event event-name
           * @param {Event} event
           */
           myMethod() { }

           /**
            * @event descriptionless-event
            */
           anotherMethod() { }
        }`);
    const events = [...getEventComments(node).values()];
    const eventMatches = events.map((ev) => ({
                                      description: ev.description,
                                      name: ev.name,
                                      params: ev.params,
                                      warnings: ev.warnings
                                    }));

    assert.deepEqual(eventMatches, [
      {
        description: 'descriptionless-event',
        name: 'descriptionless-event',
        params: [],
        warnings: []
      },
      {
        description: 'This is an event',
        name: 'event-name',
        params: [{desc: '', name: 'event', type: 'Event'}],
        warnings: []
      }
    ]);
  });
});

suite('objectKeyToString', function() {
  test('produces expected names', function() {
    const objectLiteralCode = `
    ({
      'foo': 1,
      bar: 2,
      [10]: 3,
      [10 + 20]: 4,
      ['hi' + ' there']: 5,
      [identifier]: 6,
    });
    `;
    const statement = babylon.parse(objectLiteralCode).program.body[0];
    if (!babel.isExpressionStatement(statement)) {
      throw new Error('');
    }
    const expr = statement.expression;
    if (!babel.isObjectExpression(expr)) {
      throw new Error('');
    }
    assert.deepEqual(
        [...getSimpleObjectProperties(expr)].map(
            (prop) => getPropertyName(prop)),
        ['foo', 'bar', '10', '30', 'hi there', undefined]);
  });
});
