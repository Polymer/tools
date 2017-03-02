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


import {assert, use as chaiUse} from 'chai';
import * as path from 'path';

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ScannedPolymerElement} from '../../polymer/polymer-element';
import {Polymer2ElementScanner} from '../../polymer/polymer2-element-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {CodeUnderliner} from '../test-utils';

chaiUse(require('chai-subset'));

suite('Polymer2ElementScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/polymer2/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getElements(
      filename: string): Promise<ScannedPolymerElement[]> {
    const file = await urlLoader.load(filename);
    const parser = new JavaScriptParser();
    const document = parser.parse(file, filename);
    const scanner = new Polymer2ElementScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const features = await scanner.scan(document, visit);
    return features.filter(
        (e) => e instanceof ScannedPolymerElement) as ScannedPolymerElement[];
  };

  function getTestProps(element: ScannedPolymerElement): any {
    const props: any = {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      summary: element.summary,
      properties: element.properties.map((p) => ({
                                           name: p.name,
                                         })),
      attributes: element.attributes.map((a) => ({
                                           name: a.name,
                                         })),
      methods: element.methods.map(
          (m) => ({name: m.name, params: m.params, return: m.return })),

    };
    if (element.mixins.length > 0) {
      props.mixins = element.mixins.map((m) => m.identifier);
    }
    return props;
  }

  test('Finds two basic elements', async() => {
    const elements = await getElements('test-element-1.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      },
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: 'A very basic element',
        summary: 'A basic element',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      },
    ]);

    const underlinedSource1 =
        await underliner.underline(elements[0].sourceRange);
    assert.equal(underlinedSource1, `
class TestElement extends Polymer.Element {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  static get properties() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~
    return {
~~~~~~~~~~~~
      foo: {
~~~~~~~~~~~~
        notify: true,
~~~~~~~~~~~~~~~~~~~~~
        type: String,
~~~~~~~~~~~~~~~~~~~~~
      }
~~~~~~~
    }
~~~~~
  }
~~~
}
~`);

    const underlinedSource2 =
        await underliner.underline(elements[1].sourceRange);
    assert.equal(underlinedSource2, `
class BaseElement extends Polymer.Element {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  static get properties() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~
    return {
~~~~~~~~~~~~
      foo: {
~~~~~~~~~~~~
        notify: true,
~~~~~~~~~~~~~~~~~~~~~
        type: String,
~~~~~~~~~~~~~~~~~~~~~
      },
~~~~~~~~
    };
~~~~~~
  }
~~~
}
~`);
  });

  test('Uses static is getter for tagName', async() => {
    const elements = await getElements('test-element-2.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'HTMLElement',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
      },
    ]);
  });

  test('Finds vanilla elements', async() => {
    const elements = await getElements('test-element-4.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'HTMLElement',
        description: '',
        summary: '',
        properties: [],
        attributes: [
          {
            name: 'a',
          },
          {
            name: 'b',
          }
        ],
        methods: [],
      },
    ]);
  });

  test('Observed attributes override induced attributes', async() => {
    const elements = await getElements('test-element-5.js');
    const elementData = elements.map(getTestProps);

    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [
          {
            name: 'a',
          },
          {
            name: 'b',
          }
        ],
        methods: [],
      },
    ]);
  });

  test('properly sets className for elements with the memberof tag', async() => {
    const elements = await getElements('test-element-8.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element-one',
        className: 'Polymer.TestElementOne',
        superClass: 'Polymer.Element',
        description:
            `This element is a member of Polymer namespace and is registered with its
namespaced name.`,
        summary: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      },
      {
        tagName: 'test-element-two',
        className: 'Polymer.TestElementTwo',
        superClass: 'Polymer.Element',
        description:
            `This element is a member of Polymer namespace and is registered without its
namespaced name.`,
        summary: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
      }
    ]);
  });

  test('Read mixes annotations', async() => {
    const elements = await getElements('test-element-6.js');
    const elementData = elements.map(getTestProps);

    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
        mixins: ['Mixin2', 'Mixin1'],
      },
    ]);
  });

  test('Reads just mixin application', async() => {
    const elements = await getElements('test-element-9.js');
    const elementData = elements.map(getTestProps);

    assert.deepEqual(elementData, [
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
      },
      {
        tagName: undefined,
        className: 'SubElement',
        superClass: 'BaseElement',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
        mixins: ['Mixin'],
      },
      {
        tagName: undefined,
        className: 'SubElement2',
        superClass: 'BaseElement',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
        mixins: ['Mixin'],
      },
    ]);
  });

  test(
      'properly reads properties and methods of elements and element classes',
      async() => {
        const elements = await getElements('test-element-10.js');
        const elementData = elements.map(getTestProps);
        assert.deepEqual(elementData, [
          {
            tagName: 'test-element',
            className: 'TestElement',
            superClass: 'Polymer.Element',
            description: ``,
            summary: '',
            properties: [{
              name: 'foo',
            }],
            attributes: [{
              name: 'foo',
            }],
            methods: [
              {name: 'customInstanceFunction', params: [], return: undefined},
              {
                name: 'customInstanceFunctionWithJSDoc',
                params: [], return: undefined
              },
              {
                name: 'customInstanceFunctionWithParams',
                params: [{name: 'a'}, {name: 'b'}, {name: 'c'}],
                return: undefined,
              },
              {
                name: 'customInstanceFunctionWithParamsAndJSDoc',
                params: [{name: 'a'}, {name: 'b'}, {name: 'c'}],
                return: undefined,
              },
              {
                name: 'customInstanceFunctionWithParamsAndPrivateJSDoc',
                params: [], return: undefined,
              },
            ],
          },
        ]);
      });
});
