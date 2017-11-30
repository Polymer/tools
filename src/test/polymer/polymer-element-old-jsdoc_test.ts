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
import * as path from 'path';

import {Analyzer} from '../../core/analyzer';
import {ClassScanner} from '../../javascript/class-scanner';
import {Document} from '../../model/model';
import {PolymerElement} from '../../polymer/polymer-element';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

suite('PolymerElement with old jsdoc annotations', () => {
  const testFilesDir = path.resolve(__dirname, '../static/polymer2-old-jsdoc/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const analyzer = new Analyzer({
    urlLoader: urlLoader,
    scanners: new Map([[
      'js',
      [
        new ClassScanner(),
      ]
    ]])
  });

  async function getElements(filename: string): Promise<Set<PolymerElement>> {
    const document =
        (await analyzer.analyze([filename])).getDocument(filename) as Document;
    const elements = document.getFeatures({kind: 'polymer-element'});
    return elements;
  };

  function getTestProps(element: PolymerElement): any {
    return {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      properties:
          Array.from(element.properties.values()).map((p) => ({
                                                        name: p.name,
                                                        inheritedFrom:
                                                            p.inheritedFrom,
                                                      })),
      attributes: Array.from(element.attributes.values()).map((a) => ({
                                                                name: a.name,
                                                              })),
      methods: Array.from(element.methods.values()).map((m) => ({
                                                          name: m.name,
                                                          params: m.params,
                                                          return: m.return,
                                                          inheritedFrom:
                                                              m.inheritedFrom
                                                        })),
    };
  }

  test('Scans and resolves base and sub-class', async () => {
    const elements = await getElements('test-element-3.js');
    const elementData = Array.from(elements).map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: '',
        properties: [{
          name: 'foo',
          inheritedFrom: undefined,
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      },
      {
        tagName: 'sub-element',
        className: 'SubElement',
        superClass: 'BaseElement',
        description: '',
        properties: [
          {
            name: 'foo',
            inheritedFrom: 'BaseElement',
          },
          {
            name: 'bar',
            inheritedFrom: undefined,
          },
        ],
        attributes: [
          {
            name: 'foo',
          },
          {
            name: 'bar',
          },
        ],
        methods: [],
      },
    ]);
  });

  test('Elements inherit from mixins and base classes', async () => {
    const elements = await getElements('test-element-7.js');
    const elementData = Array.from(elements).map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: '',
        properties: [
          {
            name: 'one',
            inheritedFrom: undefined,
          },
          {
            name: 'two',
            inheritedFrom: undefined,
          }
        ],
        attributes: [
          {
            name: 'one',
          },
          {
            name: 'two',
          }
        ],
        methods: [{
          name: 'customMethodOnBaseElement',
          params: [],
          return: undefined,
          inheritedFrom: undefined
        }],
      },
      {
        tagName: 'sub-element',
        className: 'SubElement',
        superClass: 'BaseElement',
        description: '',
        properties: [
          {
            name: 'one',
            inheritedFrom: 'BaseElement',
          },
          {
            name: 'two',
            inheritedFrom: 'Mixin',
          },
          {
            name: 'three',
            inheritedFrom: 'Mixin',
          },
          {
            name: 'four',
            inheritedFrom: undefined,
          },
          {
            inheritedFrom: undefined,
            name: 'five',
          },
        ],
        attributes: [
          {
            name: 'one',
          },
          {
            name: 'two',
          },
          {
            name: 'three',
          },
          {
            name: 'four',
          },
          {
            name: 'five',
          },
        ],
        methods: [
          {
            name: 'customMethodOnBaseElement',
            params: [],
            return: undefined,
            inheritedFrom: 'BaseElement'
          },
          {
            name: 'customMethodOnMixin',
            params: [],
            return: undefined,
            inheritedFrom: 'Mixin'
          },
          {
            name: 'customMethodOnSubElement',
            params: [],
            return: undefined,
            inheritedFrom: undefined
          },
        ],
      },
    ]);
  });
});
