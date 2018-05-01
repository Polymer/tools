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
import {Severity, Warning} from '../../model/model';
import {PolymerElement} from '../../polymer/polymer-element';
import {createForDirectory, fixtureDir} from '../test-utils';

suite('PolymerElement', () => {
  let analyzer: Analyzer;

  before(async () => {
    ({analyzer} =
         await createForDirectory(path.resolve(fixtureDir, 'polymer2/')));
  });

  async function getElements(filename: string): Promise<Set<PolymerElement>> {
    const result = (await analyzer.analyze([filename])).getDocument(filename);
    if (!result.successful) {
      throw new Error(`Could not get filename: ${filename}`);
    }
    const document = result.value;
    const elements = document.getFeatures({kind: 'polymer-element'});
    return elements;
  }

  function getTestProps(element: PolymerElement) {
    return {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      properties: Array.from(element.properties.values()).map((p) => {
        const prop: {
          name: string,
          inheritedFrom?: string,
          reflectToAttribute?: boolean,
          readOnly?: boolean,
          default?: string
        } = {name: p.name, inheritedFrom: p.inheritedFrom};
        p.reflectToAttribute &&
            (prop.reflectToAttribute = p.reflectToAttribute);
        p.readOnly && (prop.readOnly = p.readOnly);
        p.default && (prop.default = p.default);
        return prop;
      }),
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
      {
        tagName: undefined,
        className: 'WindowBaseElement',
        superClass: 'Polymer.Element',
        description: '',
        properties: [],
        attributes: [],
        methods: [],
      },
      {
        tagName: undefined,
        className: 'WindowSubElement',
        superClass: 'Polymer.WindowBaseElement',
        description: '',
        properties: [],
        attributes: [],
        methods: [],
      },
    ]);
  });

  test('Computes correct property information', async () => {
    const elements = await getElements('test-element-17.js');
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
          reflectToAttribute: true,
          readOnly: true,
          default: '"foo"'
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      },
    ]);
  });

  test('Handles inner classes properly', async () => {
    const elements = await getElements('test-element-18.js');
    const elementData = Array.from(elements).map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'hello-world',
        className: 'HelloWorld',
        superClass: 'Polymer.Element',
        description: '',
        properties: [],
        attributes: [],
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

  suite('multiple-doc-comments', () => {
    async function getElement(filename: string) {
      const elements = await getElements(filename);
      assert.equal(
          elements.size, 1, `${filename} contained ${elements.size} elements`);
      return [...elements][0]!;
    }

    test('Elements with only one doc comment have no warning', async () => {
      const element = await getElement('test-element-14.html');
      const warning = element.warnings.find(
          (w: Warning) => w.code === 'multiple-doc-comments');
      assert.isUndefined(warning);
    });

    test('Elements with more than one doc comment have warning', async () => {
      const element = await getElement('test-element-15.html');
      const warning = element.warnings.find(
          (w: Warning) => w.code === 'multiple-doc-comments')!;
      assert.isDefined(warning);
      assert.deepEqual(warning.severity, Severity.WARNING);
      assert.deepEqual(
          warning.message,
          'ScannedPolymerElement has both HTML doc and JSDoc comments.');
      assert.deepEqual(warning.sourceRange, element.sourceRange);
    });
  });
});
