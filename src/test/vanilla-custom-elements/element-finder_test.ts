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
import * as fs from 'fs';
import * as path from 'path';

import {Analyzer} from '../../analyzer';
import {BehaviorDescriptor, Descriptor} from '../../ast/ast';
import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ElementFinder, VanillaElementDescriptor} from '../../vanilla-custom-elements/element-finder';

suite('BehaviorFinder', () => {

  let document: JavaScriptDocument;
  let analyzer: Analyzer;
  let elements: Map<string, VanillaElementDescriptor>;
  let elementsList: VanillaElementDescriptor[];

  suiteSetup(() => {

    let parser = new JavaScriptParser();
    let file = fs.readFileSync(
        path.resolve(__dirname, '../static/vanilla-elements.js'), 'utf8');
    document = parser.parse(file, '/static/vanilla-elements.js');
    let finder = new ElementFinder();
    let visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    return finder.findEntities(document, visit)
        .then((entities: Descriptor[]) => {
          elements = new Map();
          elementsList = <VanillaElementDescriptor[]>entities.filter(
              (e) => e instanceof VanillaElementDescriptor);
          for (let element of elementsList) {
            elements.set(element.is, element);
          }
        });
  });

  test('Finds elements', () => {
    assert.deepEqual(elementsList.map(e => e.is).sort(), [
      'anonymous-class', 'class-declaration', 'class-expression',
      'with-observed-attributes', 'register-before-declaration',
      'register-before-expression'
    ].sort());
    assert.deepEqual(elementsList.map(e => e.className).sort(), [
      undefined, 'ClassDeclaration', 'ClassExpression',
      'WithObservedAttributes', 'RegisterBeforeDeclaration',
      'RegisterBeforeExpression'
    ].sort());
  });

  test('Extracts attributes from observedAttributes', () => {
    const element = elements.get('with-observed-attributes');
    assert.deepEqual(element.attributes.length, 2);
  });
});
