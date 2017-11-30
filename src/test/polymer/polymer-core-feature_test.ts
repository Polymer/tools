/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import * as path from 'path';

import {Analyzer} from '../../core/analyzer';
import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';
import {PolymerCoreFeatureScanner} from '../../polymer/polymer-core-feature-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

suite('PolymerCoreFeatureScanner', () => {
  test('scans _addFeature calls and the Polymer.Base assignment', async () => {
    const js = `
      /** Feature A */
      Polymer.Base._addFeature({
        /** Method A */
        methodA: function() {},
        /** Prop A */
        propA: []
      });

      /** Feature B */
      Polymer.Base._addFeature({
        methodB: function() {},
        methodB2() {}
      });

      /** Polymer.Base declaration */
      Polymer.Base = {
        methodBase: function() {}
      };

      /** Invalid feature */
      Polymer.Base._addFeature(null);

      /** Not a feature at all */
      Polymer.Base._somethingElse({
        methodX: function() {}
      });
    `;

    const parser = new JavaScriptParser();
    const scanner = new PolymerCoreFeatureScanner();
    const doc = parser.parse(js, 'features.js' as ResolvedUrl);
    const visit = (visitor: Visitor) => Promise.resolve(doc.visit([visitor]));
    const {features} = await scanner.scan(doc, visit);

    assert.lengthOf(features, 4);
    const [a, b, base, invalid] = features;

    assert.equal(a.description, 'Feature A');
    assert.deepEqual(a.warnings, []);
    assert.deepEqual(
        [...a.properties.values()].map(
            ({name, type, description}) => ({name, type, description})),
        [{
          name: 'propA',
          type: 'Array',
          description: 'Prop A',
        }]);
    assert.deepEqual(
        [...a.methods.values()].map(
            ({name, type, description}) => ({name, type, description})),
        [{
          name: 'methodA',
          type: 'Function',
          description: 'Method A',
        }]);

    assert.equal(b.description, 'Feature B');
    assert.deepEqual(b.warnings, []);
    assert.deepEqual([...b.properties.values()], []);
    assert.deepEqual(
        [...b.methods.values()].map(
            ({name, type, description}) => ({name, type, description})),
        [
          {
            name: 'methodB',
            type: 'Function',
            description: '',
          },
          {
            name: 'methodB2',
            type: 'Function',
            description: '',
          }
        ]);

    assert.equal(base.description, 'Polymer.Base declaration');
    assert.deepEqual(base.warnings, []);
    assert.deepEqual([...base.properties.values()], []);
    assert.deepEqual(
        [...base.methods.values()].map(
            ({name, type, description}) => ({name, type, description})),
        [{
          name: 'methodBase',
          type: 'Function',
          description: '',
        }]);

    assert.lengthOf(invalid.warnings, 1);
  });

  test('resolves the Polymer.Base class', async () => {
    const analyzer = new Analyzer({
      urlLoader: new FSUrlLoader(
          // This directory contains files copied from Polymer 1.x core.
          path.resolve(__dirname, '../static/polymer-core-feature/')),
    });

    const analysis = await analyzer.analyzePackage();
    const features = analysis.getFeatures({id: 'Polymer.Base', kind: 'class'});
    assert.equal(features.size, 1);
    const polymerBase = features.values().next().value;
    assert.equal(polymerBase.methods.size, 35);
    assert.equal(polymerBase.properties.size, 2);

    // A method from debounce.html
    const debounce = polymerBase.methods.get('debounce');
    assert.isDefined(debounce);
    assert.equal(debounce!.privacy, 'public');
    assert.equal(debounce!.params![0].name, 'jobName');

    // A method from base.html
    const addFeature = polymerBase.methods.get('_addFeature');
    assert.isDefined(addFeature);
    assert.equal(addFeature!.privacy, 'protected');

    // A property from behaviors.html
    const behaviors = polymerBase.properties.get('behaviors');
    assert.isDefined(behaviors);
  });
});
