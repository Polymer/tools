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

import {Descriptor} from '../../ast/descriptor';
import {EntityFinder} from '../../entity/entity-finder';
import {findEntities} from '../../entity/find-entities';
import {Document} from '../../parser/document';
import {invertPromise} from '../test-utils';

suite('findEntities()', () => {

  test('calls EntityFinder.findEntities', async() => {
    let entity = Symbol('entity');
    let finder = new EntityFinderStub([entity]);
    let document = makeTestDocument({});

    const entities = await findEntities(document, [finder]);
    assert.deepEqual(entities, [entity]);
    assert.deepEqual(finder.calls, [{document}]);
    assert.deepEqual(entities, [entity]);
  });

  test('supports multiple and async calls to visit()', async() => {
    let visitor1 = Symbol('visitor1');
    let visitor2 = Symbol('visitor2');
    let visitor3 = Symbol('visitor3');
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
    let document = makeTestDocument({
      async visit(visitors: any) {
        visitedVisitors.push.apply(visitedVisitors, visitors);
      }
    });

    const entities = await findEntities(document, [finder]);
    assert.deepEqual([`an entity`], entities);
    assert.deepEqual(visitedVisitors, [visitor1, visitor2, visitor3]);
  });

  test('propagates exceptions in entity finders', () => {
    let finder = {
      findEntities(document: any, visit: any) {
        throw new Error('expected');
      },
    };
    return invertPromise(findEntities(makeTestDocument({}), <any>[finder]));
  });

  test('propagates exceptions in visitors', () => {
    let document: any = makeTestDocument({
      visit: (): Promise<any> => {
        throw new Error('expected');
      },
    });
    return invertPromise(findEntities(document, [makeTestEntityFinder({})]));
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
    Document<string, any> {
  return {
    type: options.type || 'test-type',
    contents: options.contents || 'test-contents',
    ast: options.ast || 'test-ast',
    url: options.url || 'test-url',
    visit: options.visit || (() => null),
    forEachNode: options.forEachNode || (() => null),
  };
}

interface TestEntityFinderMakerOptions {
  findEntities?:
      (document: Document<string, any>,
       visit: (visitor: any) => Promise<void>) => Promise<any[]>;
}
function makeTestEntityFinder(options: TestEntityFinderMakerOptions):
    EntityFinder<Document<string, any>, any, any> {
  const simpleFindEntities = (async(doc: any, visit: () => Promise<any>) => {
    const promise = visit();
    return ['test-entity'];
  });
  return {findEntities: options.findEntities || simpleFindEntities};
}

/**
 * Entity finder that always returns the given entities and tracks when
 * findEntities is called.
 */
class EntityFinderStub implements EntityFinder<any, any, any> {
  calls: {document: Document<any, any>}[];
  entities: Descriptor[];
  constructor(entities: Descriptor[]) {
    this.entities = entities;
    this.calls = [];
  }

  async findEntities(document: Document<any, any>, visit: any) {
    this.calls.push({document});
    return this.entities;
  }
}
