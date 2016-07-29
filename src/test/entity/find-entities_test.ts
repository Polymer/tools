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

'use strict';

import {assert} from 'chai';

import {EntityFinder} from '../../entity/entity-finder';
import {findEntities} from '../../entity/find-entities';
import {Descriptor} from '../../ast/descriptor';
import {Document} from '../../parser/document';
import {invertPromise} from '../test-utils';

suite('findEntities()', () => {

  test('calls EntityFinder.findEntities', () => {
    let entity = {
      type: 'html',
      url: 'abc',
    };
    let finder = new EntityFinderStub([entity]);
    let document: Document<null, any> = {
      type: 'html',
      url: 'test-url',
      contents: 'test-contents',
      ast: null,
      visit(visitors) {
        return Promise.resolve();
      },
      forEachNode(callback) {
        return null;
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
    let finder: EntityFinder<any, any, any> = {
      async findEntities(
          document: Document<any, any>,
          visit: (visitor: any) => Promise<void>) {
        // two visitors in one batch
        await Promise.all([visit(visitor1), visit(visitor2)]);

        // one visitor in a subsequent batch, delayed a turn to make sure
        // we can call visit() truly async
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            visit(visitor3).then(resolve);
          }, 0);
        });
        return [`an entity`];
      },
    };
    let visitedVisitors: any[] = [];
    let document: Document<string, any> = {
      type: 'test',
      url: 'test-url',
      contents: 'test-contents',
      ast: 'test-ast',
      visit(visitors: any) {
        visitedVisitors.push.apply(visitedVisitors, visitors);
      },
      forEachNode: (callback: any) => null,
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
      findEntities(document: any, visit: any) {
        throw new Error('expected');
      },
    };
    let document = {
      type: 'html',
      visit(visitors: any) {
        return Promise.resolve();
      },
      forEachNode: (callback: any): void => null,
    };
    return invertPromise(findEntities(<any>document, <any>[finder]));
  });

  test('propagates exceptions in visitors', () => {
    let finder = {
      findEntities(document: any, visit: any) {
        return visit((x: any) => x);
      },
    };
    let document: any = {
      type: 'html',
      visit(visitors: any) {
        throw new Error('expected');
      },
      forEachNode: (callback: any): void => null,
    };
    return invertPromise(findEntities(document, [finder]));
  });

});


class EntityFinderStub implements EntityFinder<any, any, any> {
  calls: {document: Document<any, any>, visit: any}[];
  entities: Descriptor[];
  constructor(entities: Descriptor[]) {
    this.entities = entities;
    this.calls = [];
  }

  findEntities(document: Document<any, any>, visit: any) {
    this.calls.push({document, visit});
    return Promise.resolve(this.entities);
  }
}
