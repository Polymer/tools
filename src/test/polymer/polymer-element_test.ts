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

import {Analyzer} from '../../analyzer';
import {PolymerElement} from '../../polymer/polymer-element';
import {Polymer2ElementScanner} from '../../polymer/polymer2-element-scanner';
import {Polymer2MixinScanner} from '../../polymer/polymer2-mixin-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

suite('PolymerElement', () => {
  const testFilesDir = path.resolve(__dirname, '../static/polymer2/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const analyzer = new Analyzer({
    urlLoader: urlLoader,
    scanners: new Map([[
      'js',
      [
        new Polymer2ElementScanner(),
        new Polymer2MixinScanner(),
      ]
    ]])
  });

  async function getElements(filename: string): Promise<Set<PolymerElement>> {
    const document = await analyzer.analyze(filename);
    const elements = document.getByKind('polymer-element');
    return elements;
  };

  function getTestProps(element: PolymerElement): any {
    return {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      properties: element.properties.map((p) => ({
                                           name: p.name,
                                         })),
      attributes: element.attributes.map((a) => ({
                                           name: a.name,
                                         })),
    };
  }

  test('Scans base and sub-class', async() => {
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
        }],
        attributes: [{
          name: 'foo',
        }],
      },
      {
        tagName: 'sub-element',
        className: 'SubElement',
        superClass: 'BaseElement',
        description: '',
        properties: [
          {
            name: 'foo',
          },
          {
            name: 'bar',
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
      },
    ]);
  });

  test('Elements inherit from mixins and base classes', async() => {
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
          },
          {
            name: 'two',
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
      },
      {
        tagName: 'sub-element',
        className: 'SubElement',
        superClass: 'BaseElement',
        description: '',
        properties: [
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
          }
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
          }
        ],
      },
    ]);
  });

});
