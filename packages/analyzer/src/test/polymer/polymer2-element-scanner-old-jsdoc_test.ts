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

import {Analyzer} from '../../core/analyzer';
import {ClassScanner} from '../../javascript/class-scanner';
import {ScannedPolymerElement} from '../../polymer/polymer-element';
import {CodeUnderliner, createForDirectory, fixtureDir, runScanner} from '../test-utils';

chaiUse(require('chai-subset'));

suite('Polymer2ElementScanner with old jsdoc annotations', () => {
  let analyzer: Analyzer;
  let underliner: CodeUnderliner;
  before(async () => {
    const testFilesDir = path.resolve(fixtureDir, 'polymer2-old-jsdoc/');
    ({analyzer, underliner} = await createForDirectory(testFilesDir));
  });

  async function getElements(filename: string):
      Promise<ScannedPolymerElement[]> {
    const {features} = await runScanner(analyzer, new ClassScanner(), filename);
    return features.filter((e) => e instanceof ScannedPolymerElement) as
        ScannedPolymerElement[];
  }

  async function getTestProps(element: ScannedPolymerElement) {
    // tslint:disable-next-line: no-any Hacky test code
    const props: any = {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      summary: element.summary,
      properties: await Promise.all(
          Array.from(element.properties.values()).map(async (p) => {
            // tslint:disable-next-line: no-any Hacky test code
            const result = {name: p.name, description: p.description} as any;
            if (p.type) {
              result.type = p.type;
            }
            if (p.observerExpression) {
              result.propertiesInObserver =
                  p.observerExpression.properties.map((p) => p.name);
            }
            if (p.computedExpression) {
              result.propertiesInComputed =
                  p.computedExpression.properties.map((p) => p.name);
            }
            if (p.warnings.length > 0) {
              result.warningUnderlines = await underliner.underline(p.warnings);
            }
            return result;
          })),
      attributes: Array.from(element.attributes.values()).map((a) => ({
                                                                name: a.name,
                                                              })),
      methods:
          Array.from(element.methods.values()).map((m) => ({
                                                     name: m.name,
                                                     params: m.params,
                                                     return: m.return,
                                                     description: m.description
                                                   })),

      warningUnderlines: await underliner.underline(element.warnings),

    };
    if (element.observers.length > 0) {
      props.observers = element.observers.map((o) => o.expression);
      props.observerProperties =
          element.observers.filter((o) => o.parsedExpression)
              .map((o) => o.parsedExpression!.properties.map((p) => p.name));
    }
    if (element.mixins.length > 0) {
      props.mixins = element.mixins.map((m) => m.identifier);
    }
    return props;
  }

  test('Finds two basic elements', async () => {
    const elements = await getElements('test-element-1.js');
    const elementData = await Promise.all(elements.map(getTestProps));
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [{
          name: 'foo',
          description: 'The foo prop.',
          type: '(m-test | function)',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
        warningUnderlines: [],
      },
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: 'A very basic element',
        summary: 'A basic element',
        properties: [{
          name: 'foo',
          description: 'A base foo element.',
          type: 'string | null | undefined',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
        warningUnderlines: [],
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
      /**
~~~~~~~~~
       * The foo prop.
~~~~~~~~~~~~~~~~~~~~~~
       * @public
~~~~~~~~~~~~~~~~
       * @type {m-test|function}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
       */
~~~~~~~~~
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
      /** A base foo element. */
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
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

  test('Uses static is getter for tagName', async () => {
    const elements = await getElements('test-element-2.js');
    const elementData = await Promise.all(elements.map(getTestProps));
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
        warningUnderlines: [],
      },
    ]);
  });

  test('Finds vanilla elements', async () => {
    const elements = await getElements('test-element-4.js');
    const elementData = await Promise.all(elements.map(getTestProps));
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
        warningUnderlines: [],
      },
    ]);
  });

  test('Observed attributes override induced attributes', async () => {
    const elements = await getElements('test-element-5.js');
    const elementData = await Promise.all(elements.map(getTestProps));

    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        summary: '',
        properties: [{
          name: 'foo',
          description: '',
          type: 'string | null | undefined',
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
        warningUnderlines: [],
      },
    ]);
  });

  test('properly sets className for elements with the memberof tag', async () => {
    const elements = await getElements('test-element-8.js');
    const elementData = await Promise.all(elements.map(getTestProps));
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
          description: '',
          type: 'string | null | undefined',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
        warningUnderlines: [],
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
          description: '',
          type: 'string | null | undefined',
        }],
        attributes: [{
          name: 'foo',
        }],
        methods: [],
        warningUnderlines: [],
      }
    ]);
  });

  test('Read @appliesMixin annotations', async () => {
    const elements = await getElements('test-element-6.js');
    const elementData = await Promise.all(elements.map(getTestProps));

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
        warningUnderlines: [],
      },
    ]);
  });

  test('Reads just @appliesMixin annotation', async () => {
    const elements = await getElements('test-element-9.js');
    const elementData = await Promise.all(elements.map(getTestProps));

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
        warningUnderlines: [],
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
        warningUnderlines: [],
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
        warningUnderlines: [],
      },
      {
        tagName: undefined,
        className: 'window.MyElement',
        superClass: 'MixedElement',
        description: '',
        summary: '',
        properties: [],
        attributes: [],
        methods: [],
        mixins: ['MyMixin'],
        warningUnderlines: [],
      }
    ]);
  });

  test(
      'properly reads properties and methods of elements and element classes',
      async () => {
        const elements = await getElements('test-element-10.js');
        const elementData = await Promise.all(elements.map(getTestProps));
        assert.deepEqual(elementData, [
          {
            tagName: 'test-element',
            className: 'TestElement',
            superClass: 'Polymer.Element',
            description: ``,
            summary: '',
            properties: [
              {name: 'customInstanceGetter', description: undefined},
              {
                name: 'foo',
                description: '',
                type: 'string | null | undefined',
              }
            ],
            attributes: [{
              name: 'foo',
            }],
            methods: [
              {
                name: 'customInstanceFunction',
                description: '',
                params: [],
                return: undefined
              },
              {
                name: 'customInstanceFunctionWithJSDoc',
                description: 'This is the description for ' +
                    'customInstanceFunctionWithJSDoc.',
                params: [],
                return: {
                  desc: 'The number 5, always.',
                  type: 'Number',
                },
              },
              {
                name: 'customInstanceFunctionWithParams',
                description: '',
                params: [
                  {
                    name: 'a',
                    type: undefined,
                    defaultValue: undefined,
                    rest: undefined,
                    description: undefined
                  },
                  {
                    name: 'b',
                    type: undefined,
                    defaultValue: undefined,
                    rest: undefined,
                    description: undefined
                  },
                  {
                    name: 'c',
                    type: undefined,
                    defaultValue: undefined,
                    rest: undefined,
                    description: undefined
                  }
                ],
                return: undefined,
              },
              {
                name: 'customInstanceFunctionWithParamsAndJSDoc',
                description: 'This is the description for ' +
                    'customInstanceFunctionWithParamsAndJSDoc.',
                params: [
                  {
                    name: 'a',
                    type: 'Number',
                    defaultValue: undefined,
                    rest: undefined,
                    description: 'The first argument',
                  },
                  {
                    name: 'b',
                    type: 'Number',
                    defaultValue: undefined,
                    rest: undefined,
                    description: undefined
                  },
                  {
                    name: 'c',
                    type: 'Number',
                    defaultValue: undefined,
                    rest: undefined,
                    description: 'The third argument',
                  }
                ],
                return: {
                  desc: 'The number 7, always.',
                  type: 'Number',
                },
              },
              {
                name: 'customInstanceFunctionWithParamsAndPrivateJSDoc',
                description: 'This is the description for\n' +
                    'customInstanceFunctionWithParamsAndPrivateJSDoc.',
                params: [],
                return: undefined,
              },
            ],
            warningUnderlines: [],
          },
        ]);
      });

  test('warns for bad observers and computed properties', async () => {
    const elements = await getElements('test-element-12.js');
    const elementData = await Promise.all(elements.map(getTestProps));
    assert.deepEqual(
        elementData, [{
          attributes: [{name: 'parse-error'}, {name: 'bad-kind-of-expression'}],
          className: 'TestElement',
          description: '',
          methods: [],
          properties: [
            {
              name: 'parseError',
              type: 'string | null | undefined',
              description: '',
              warningUnderlines: [
                `
        computed: 'let let let',
                       ~`,
                `
        observer: 'let let let',
                       ~`,
              ]
            },
            {
              name: 'badKindOfExpression',
              type: 'string | null | undefined',
              description: '',
              propertiesInComputed: ['foo'],
              propertiesInObserver: ['foo', 'bar', 'baz'],
              warningUnderlines: [
                `
        computed: 'foo',
                   ~~~`,
                `
        observer: 'foo(bar, baz)'
                   ~~~~~~~~~~~~~`,
              ]
            }
          ],
          summary: '',
          superClass: 'Polymer.Element',
          tagName: 'test-element',
          warningUnderlines: [
            `
      'let let let parseError',
           ~`,
            `
      'foo',
       ~~~`
          ],
          observers: [
            'let let let parseError',
            'foo',
            'foo(bar)',
          ],
          observerProperties: [['foo'], ['foo', 'bar']],
        }]);
  });

  test('can identify elements registered with ClassName.is', async () => {
    const elements = await getElements('test-element-11.js');
    const elementData = await Promise.all(elements.map(getTestProps));
    assert.deepEqual(elementData, [
      {
        attributes: [{name: 'prop1'}],
        className: 'MyElement',
        description: '',
        methods: [],
        properties: [
          {name: 'prop1', description: '', type: 'string | null | undefined'}
        ],
        summary: '',
        superClass: 'Polymer.Element',
        tagName: 'my-app',
        warningUnderlines: [],
      }
    ]);
  });
});
