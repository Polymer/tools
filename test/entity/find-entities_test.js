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

"use strict";

const assert = require('chai').assert;

const findEntities = require('../../lib/entity/find-entities').findEntities;
const Document = require('../../lib/parser/document').Document;
const invertPromise = require('../test-utils').invertPromise;

suite('findEntities()', () => {

  test('calls EntityFinder.findEntities', () => {
    let entity = {
      type: 'html',
      url: 'abc',
    };
    let finder = new EntityFinderStub([entity]);
    let document = {
      type: 'html',
      visit(visitors) {
        return Promise.resolve();
      },
    };
    return findEntities(document, [finder]).then((entities) => {
      assert.equal(finder.calls.length, 1);
      assert.equal(finder.calls[0].document, document);
      assert.equal(entities.length, 1);
      assert.equal(entities[0], entity);
    });
  });

  test('supports multiple and async calls to visit()', () => {
    let visitor1 = {};
    let visitor2 = {};
    let visitor3 = {};
    let finder = {
      findEntities(document, visit) {
        // two visitors in one batch
        return Promise.all([visit(visitor1), visit(visitor2)])
            .then(() => {
              // one visitor in a subsequent batch, delayed a turn to make sure
              // we can call visit() truly async
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  visit(visitor3).then(resolve);
                }, 0);
              });
            })
            .then(() => {
              return [`an entity`];
            });
      },
    };
    let visitedVisitors = [];
    let document = {
      type: 'test',
      visit(visitors) {
        visitedVisitors.push.apply(visitedVisitors, visitors);
      },
    };

    return findEntities(document, [finder]).then((entities) => {
      assert.equal(visitedVisitors.length, 3);
      assert.equal(visitedVisitors[0], visitor1);
      assert.equal(visitedVisitors[1], visitor2);
      assert.equal(visitedVisitors[2], visitor3);
    });
  });

  test('propagates exceptions in entity finders', () => {
    let finder = {
      findEntities(document, visit) {
        throw new Error('expected');
      },
    };
    let document = {
      type: 'html',
      visit(visitors) {
        return Promise.resolve();
      },
    };
    return invertPromise(findEntities(document, [finder]));
  });

  test('propagates exceptions in visitors', () => {
    let finder = {
      findEntities(document, visit) {
        return visit((x) => x);
      },
    };
    let document = {
      type: 'html',
      visit(visitors) {
        throw new Error('expected');
      },
    };
    return invertPromise(findEntities(document, [finder]));
  });

});


class EntityFinderStub {
  constructor(entities) {
    this.entities = entities;
    this.calls = [];
  }

  findEntities(document, visit) {
    this.calls.push({document, visit});
    return Promise.resolve(this.entities);
  }
}
