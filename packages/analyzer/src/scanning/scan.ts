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

import {ImmutableArray} from '../model/immutable';
import {ScannedFeature, Warning} from '../model/model';
import {ParsedDocument} from '../parser/document';

import {Scanner} from './scanner';

export async function
scan<AstNode, Visitor, PDoc extends ParsedDocument<AstNode, Visitor>>(
    document: PDoc, scanners: Scanner<PDoc, AstNode, Visitor>[]) {
  // Scanners register a visitor to run via the `visit` callback passed to
  // `scan()`. We run these visitors in a batch, then pass control back
  // to the `scan()` methods by resolving a single Promise return for
  // all calls to visit() in a batch when the visitors have run.
  // Then we repeat if any visitors have registered new visitors.

  // Resolves Promises returned by visit() calls
  let batchDone: () => void;

  // Promise returned by visit()
  let visitorsPromise: Promise<void>;

  // Current batch of visitors
  let visitors: Visitor[];

  // results
  const nestedFeatures = [];
  const warnings: Warning[] = [];

  // A Promise that runs the next batch of visitors in a microtask
  let runner: Promise<void>|null = null;

  let visitError: any;
  let visitErrorFound = false;

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
    setup();

    try {
      document.visit(currentVisitors);
    } finally {
      // Let `scan` continue after calls to visit().then()
      currentDoneCallback();
    }
  };

  // The callback passed to `scan()`
  function visit(visitor: Visitor) {
    visitors.push(visitor);
    if (!runner) {
      runner = Promise.resolve().then(runVisitors).catch((error) => {
        visitErrorFound = true;
        visitError = visitError || error;
      });
    }
    return visitorsPromise;
  };

  // Ok, go!
  setup();
  const scannerPromises = scanners.map((f) => f.scan(document, visit));

  // This waits for all `scan()` calls to finish
  const nestedResults = await Promise.all(scannerPromises);

  if (visitErrorFound || !nestedResults) {
    throw visitError;
  }

  for (const {features, warnings: w} of nestedResults) {
    nestedFeatures.push(features);
    if (w !== undefined) {
      warnings.push(...w);
    }
  }

  return {features: sortFeatures(nestedFeatures), warnings};
}

function compareFeaturesBySourceLocation(
    ent1: ScannedFeature, ent2: ScannedFeature): number {
  const range1 = ent1.sourceRange;
  const range2 = ent2.sourceRange;
  if (range1 === range2) {
    // Should only be true in the `both null` case
    return 0;
  }
  if (range2 == null) {
    // ent1 comes first
    return -1;
  }
  if (range1 == null) {
    // ent1 comes second
    return 1;
  }
  const position1 = range1.start;
  const position2 = range2.start;
  if (position1.line < position2.line) {
    return -1;
  }
  if (position1.line > position2.line) {
    return 1;
  }
  // Lines are equal, compare by column.
  return position1.column - position2.column;
}

function sortFeatures(
    unorderedFeatures: ImmutableArray<ImmutableArray<ScannedFeature>>):
    ScannedFeature[] {
  const allFeatures = [];
  for (const subArray of unorderedFeatures) {
    allFeatures.push(...subArray);
  }
  return allFeatures.sort(compareFeaturesBySourceLocation);
}
