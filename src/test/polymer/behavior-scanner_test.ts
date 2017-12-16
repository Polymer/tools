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

import {Analyzer} from '../../core/analyzer';
import {ScannedBehavior, ScannedBehaviorAssignment} from '../../polymer/behavior';
import {BehaviorScanner} from '../../polymer/behavior-scanner';
import {fixtureDir, runScanner} from '../test-utils';

suite('BehaviorScanner', () => {
  let behaviors: Map<string, ScannedBehavior>;
  let behaviorsList: ScannedBehavior[];

  suiteSetup(async () => {
    const {features} = await runScanner(
        Analyzer.createForDirectory(fixtureDir),
        new BehaviorScanner(),
        'js-behaviors.js');
    behaviors = new Map();
    behaviorsList =
        <ScannedBehavior[]>features.filter((e) => e instanceof ScannedBehavior);
    for (const behavior of behaviorsList) {
      behaviors.set(behavior.className, behavior);
    }
  });

  test('Finds behavior object assignments', () => {
    assert.deepEqual(behaviorsList.map((b) => b.className).sort(), [
      'SimpleBehavior',
      'Polymer.SimpleNamespacedBehavior',
      'AwesomeBehavior',
      'Polymer.AwesomeNamespacedBehavior',
      'Really.Really.Deep.Behavior',
      'CustomBehaviorList'
    ].sort());
  });

  test('Supports behaviors at local assignments', () => {
    assert(behaviors.has('SimpleBehavior'));
    assert.equal(
        behaviors.get('SimpleBehavior')!.properties.values().next().value.name,
        'simple');
  });

  test('Supports behaviors with renamed paths', () => {
    assert(behaviors.has('AwesomeBehavior'));
    assert(behaviors.get('AwesomeBehavior')!.properties.has('custom'));
  });

  test('Supports behaviors On.Property.Paths', () => {
    assert(behaviors.has('Really.Really.Deep.Behavior'));
    assert.equal(
        behaviors.get('Really.Really.Deep.Behavior')!.properties.get('deep')!
            .name,
        'deep');
  });

  test('Supports property array on behaviors', () => {
    let defaultValue: any;
    behaviors.get('AwesomeBehavior')!.properties.forEach((prop) => {
      if (prop.name === 'a') {
        defaultValue = prop.default;
      }
    });
    assert.equal(defaultValue, 1);
  });

  test('Supports chained behaviors', function() {
    assert(behaviors.has('CustomBehaviorList'));
    const childBehaviors =
        behaviors.get('CustomBehaviorList')!.behaviorAssignments;
    const deepChainedBehaviors =
        behaviors.get('Really.Really.Deep.Behavior')!.behaviorAssignments;
    assert.deepEqual(
        childBehaviors.map((b: ScannedBehaviorAssignment) => b.name),
        ['SimpleBehavior', 'AwesomeBehavior', 'Really.Really.Deep.Behavior']);
    assert.deepEqual(
        deepChainedBehaviors.map((b: ScannedBehaviorAssignment) => b.name),
        ['Do.Re.Mi.Fa']);
  });

  test('Does not count methods as properties', function() {
    const behavior = behaviors.get('Polymer.SimpleNamespacedBehavior');
    if (!behavior) {
      throw new Error('Could not find Polymer.SimpleNamespacedBehavior');
    }
    assert.deepEqual(
        [...behavior.methods.keys()], ['method', 'shorthandMethod']);
    assert.deepEqual(
        [...behavior.properties.keys()],
        ['simple', 'object', 'array', 'attached', 'templateLiteral']);
  });

  test('Correctly transforms property types', function() {
    const behavior = behaviors.get('Polymer.SimpleNamespacedBehavior');
    if (!behavior) {
      throw new Error('Could not find Polymer.SimpleNamespacedBehavior');
    }
    assert.deepEqual(
        [...behavior.properties.values()].map(
            (p) => ({name: p.name, type: p.type})),
        [
          {name: 'simple', type: 'boolean'},
          {name: 'object', type: 'Object'},
          {name: 'array', type: 'Array'},
          {name: 'attached', type: 'Object'},
          {name: 'templateLiteral', type: 'string'}
        ]);
  });
});
