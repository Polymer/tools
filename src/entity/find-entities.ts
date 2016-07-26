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

import {Document} from '../parser/document';
import {Descriptor} from '../ast/ast';
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
  let
  visitorsPromise: Promise<void>;

  // Current batch of visitors
  let
  visitors: any[];

  // A Promise that runs the next batch of visitors in a microtask
  let
  runner: Promise<void>;

  let
  visitError: any;

  // Initializes the current batch running state
  function setup() {
    visitorsPromise =
        new Promise<void>((resolve, _) => { batchDone = resolve; });
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
    } catch (error) {
      visitError = visitError || error;
    }

    // Let `findEntities` continue after calls to visit().then()
    currentDoneCallback();
  };

  // The callback passed to `findEntities()`
  function visit(visitor: any) {
    visitors.push(visitor);
    if (!runner) {
      runner = Promise.resolve().then(runVisitors);
    }
    return visitorsPromise;
  };

  // Ok, go!
  setup();
  const finderPromises = finders.map((f) => f.findEntities(document, visit));

  // This waits for all `findEntities()` calls to finish
  const nestedEntities = await Promise.all(finderPromises);

  // TODO(justinfagnani): write a test w/ a visitor that throws to test this
  if (visitError) { throw visitError;}

  // Flatten the nested list
  return Array.prototype.concat.apply([], nestedEntities);
}
