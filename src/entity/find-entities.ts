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

import {Descriptor} from '../ast/ast';
import {Document} from '../parser/document';

import {EntityFinder} from './entity-finder';

export async function findEntities(
    document: Document<any, any>,
    finders: EntityFinder<any, any, any>[]): Promise<Descriptor[]> {
  // Finders register a visitor to run via the `visit` callback passed to
  // `findEntities()`. We run these visitors in a batch, then pass control back
  // to the `findEntities` methods by resolving a single Promise return for
  // all calls to visit() in a batch when the visitors have run.
  // Then we repeat if any visitors have registered new visitors.

  // Resolves Promises returned by visit() calls
  let batchDone: () => void;

  // Promise returned by visit()
  let visitorsPromise: Promise<void>;

  // Current batch of visitors
  let visitors: any[];

  // A Promise that runs the next batch of visitors in a microtask
  let runner: Promise<void>|null;

  let visitError: any;

  // Initializes the current batch running state
  function setup() {
    visitorsPromise = new Promise<void>((resolve, _) => {
      batchDone = resolve;
    });
    visitors = [];
    runner = null;
  }

  // Runs the current batch of visitors
  function runVisitors() {
    // Record the current state so that any new visitors are enqueued into
    // a fresh batch.
    const currentVisitors = visitors;
    const currentDoneCallback = batchDone;
    const currentVisitorsPromise = visitorsPromise;
    setup();

    try {
      document.visit(currentVisitors);
    } finally {
      // Let `findEntities` continue after calls to visit().then()
      currentDoneCallback();
    }
  };

  // The callback passed to `findEntities()`
  function visit(visitor: any) {
    visitors.push(visitor);
    if (!runner) {
      runner = Promise.resolve().then(runVisitors).catch((error) => {
        visitError = visitError || error;
        throw error;
      });
    }
    return visitorsPromise;
  };

  // Ok, go!
  setup();
  const finderPromises = finders.map((f) => f.findEntities(document, visit));

  // This waits for all `findEntities()` calls to finish
  const nestedEntities = await Promise.all(finderPromises);

  if (visitError) {
    throw visitError;
  }

  return orderEntities(document, nestedEntities);
}

function orderEntities(
    document: Document<any, any>,
    unorderedEntities: Descriptor[][]): Descriptor[] {
  // Build a map of node -> entities
  let entitiesByNode = new Map<any, Descriptor[]>();
  for (let entitySet of unorderedEntities) {
    for (let entity of entitySet) {
      let node = entity.node || null;  // convert undefined to null
      let entities = entitiesByNode.get(node);
      if (!entities) {
        entities = [];
        entitiesByNode.set(node, entities);
      }
      entities.push(entity);
    }
  }

  // Walk the document to build document ordered entities list
  let orderedEntities: Descriptor[][] = [];
  document.forEachNode((node: any) => {
    const entities = entitiesByNode.get(node);
    if (entities) {
      orderedEntities.push(entities);
      entitiesByNode.delete(node);
    }
  });

  // All entities not associated with a node, or associated with a node that
  // wasn't visited by document.forEachNode come last.
  // TODO(justinfagnani): shouldn't this be a warning?
  let orhphanedEntities = entitiesByNode.values();
  for (let entitySet of orhphanedEntities) {
    orderedEntities.push(entitySet);
  }

  return Array.prototype.concat.apply([], orderedEntities);
}
