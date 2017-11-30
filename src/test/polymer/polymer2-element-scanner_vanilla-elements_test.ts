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


import * as chai from 'chai';
import {assert} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import {ClassScanner} from '../../javascript/class-scanner';
import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';
import {ScannedPolymerElement} from '../../polymer/polymer-element';


//
// NOTE: THis test was copied from
// /src/test/vanilla-custom-elements/element-scanner_test.js
// to ensure that Polymer2ElementScanner can scan vanilla elements while we
// disable the vanilla element scanner for a short time.
//
// Do not modify this test any more, so that we don't have to sync changes
//

chai.use(require('chai-subset'));

suite('Polymer2ElementScanner - Vanilla Element Scanning', () => {
  const elements = new Map<string|undefined, ScannedPolymerElement>();
  let document: JavaScriptDocument;
  let elementsList: ScannedPolymerElement[];

  suiteSetup(async () => {
    const parser = new JavaScriptParser();
    const file = fs.readFileSync(
        path.resolve(__dirname, '../static/vanilla-elements.js'), 'utf8');
    document = parser.parse(file, '/static/vanilla-elements.js' as ResolvedUrl);
    const scanner = new ClassScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const {features} = await scanner.scan(document, visit);

    elementsList = features.filter((e) => e instanceof ScannedPolymerElement) as
        ScannedPolymerElement[];
    for (const element of elementsList) {
      elements.set(element.tagName, element);
    }
  });

  test('Finds elements', () => {
    assert.deepEqual(elementsList.map((e) => e.tagName).sort(), [
      'anonymous-class',
      'class-declaration',
      'class-expression',
      'vanilla-with-observed-attributes',
      'register-before-declaration',
      'register-before-expression'
    ].sort());
    assert.deepEqual(elementsList.map((e) => e.className).sort(), [
      undefined,
      'ClassDeclaration',
      'ClassExpression',
      'WithObservedAttributes',
      'RegisterBeforeDeclaration',
      'RegisterBeforeExpression'
    ].sort());
    assert.deepEqual(
        elementsList.map((e) => e.superClass && e.superClass.identifier).sort(),
        [
          'HTMLElement',
          'HTMLElement',
          'HTMLElement',
          'HTMLElement',
          'HTMLElement',
          'HTMLElement',
        ].sort());
  });

  test('Extracts attributes from observedAttributes', () => {
    const element = elements.get('vanilla-with-observed-attributes')!;
    assert.containSubset(Array.from(element.attributes.values()), [
      {
        description: 'When given the element is totally inactive',
        name: 'disabled',
        type: 'boolean',
        sourceRange: {
          file: '/static/vanilla-elements.js',
          start: {column: 6, line: 25},
          end: {column: 16, line: 25}
        }
      },
      {
        description: 'When given the element is expanded',
        name: 'open',
        type: 'boolean',
        sourceRange: {
          file: '/static/vanilla-elements.js',
          start: {column: 6, line: 27},
          end: {column: 12, line: 27}
        }
      },
      {
        description: '',
        name: 'foo',
        sourceRange: {
          file: '/static/vanilla-elements.js',
          start: {column: 14, line: 27},
          end: {column: 19, line: 27}
        },
      },
      {
        description: '',
        name: 'bar',
        sourceRange: {
          file: '/static/vanilla-elements.js',
          start: {column: 21, line: 27},
          end: {column: 26, line: 27}
        },
      }
    ]);
  });

  test('Extracts description from jsdoc', () => {
    const element = elements.get('vanilla-with-observed-attributes');
    assert.equal(
        element!.description,
        'This is a description of WithObservedAttributes.');
  });
});
