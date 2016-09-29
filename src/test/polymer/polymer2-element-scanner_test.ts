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

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ScannedElement, ScannedFeature} from '../../model/model';
import {Polymer2ElementScanner} from '../../polymer/polymer2-element-scanner';

function compareTagNames(a: {tagName?: string}, b: {tagName?: string}): number {
  const tagNameA = a && a.tagName;
  const tagNameB = b && b.tagName;

  if (tagNameA == null)
    return (tagNameB == null) ? 0 : -1;
  if (tagNameB == null)
    return 1;
  return tagNameA.localeCompare(tagNameB);
};

suite('Polymer2ElementScanner', () => {

  let document: JavaScriptDocument;
  let elements: Map<string|undefined, ScannedElement>;
  let elementsList: ScannedElement[];

  suiteSetup(async() => {
    let parser = new JavaScriptParser({sourceType: 'script'});
    let file = fs.readFileSync(
        path.resolve(__dirname, '../static/polymer2/test-element.js'), 'utf8');
    document = parser.parse(file, '/static/polymer2/test-element.js');
    let scanner = new Polymer2ElementScanner();
    let visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const features: ScannedFeature[] = await scanner.scan(document, visit);
    elements = new Map();
    elementsList =
        <ScannedElement[]>features.filter((e) => e instanceof ScannedElement);
    for (let element of elementsList) {
      elements.set(element.tagName, element);
    }
  });

  test('Finds elements', () => {
    const sortedElements = elementsList.sort(compareTagNames);
    const elementData =
        sortedElements.map((e) => ({
                             tagName: e.tagName,
                             className: e.className,
                             superClass: e.superClass,
                             properties: e.properties.map((p) => ({
                                                            name: p.name,
                                                          })),
                             attributes: e.attributes.map((a) => ({
                                                            name: a.name,
                                                          })),
                           }));

    assert.deepEqual(elementData, [
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
      },
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
      }
    ].sort(compareTagNames));
  });

});
