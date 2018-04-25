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
import {ClassScanner} from '../../javascript/class-scanner';
import {Class, Element, ElementMixin, Method, ScannedClass} from '../../model/model';
import {CodeUnderliner, createForDirectory, fixtureDir, runScanner} from '../test-utils';

// tslint:disable: no-any This test is pretty hacky, uses a lot of any.
suite('Class', () => {
  let analyzer: Analyzer;
  let underliner: CodeUnderliner;

  before(async () => {
    ({analyzer, underliner} = await createForDirectory(fixtureDir));
  });

  async function getScannedFeatures(filename: string) {
    const {features} = await runScanner(analyzer, new ClassScanner(), filename);
    return features;
  }

  async function getScannedClasses(filename: string): Promise<ScannedClass[]> {
    const features = await getScannedFeatures(filename);
    return features.filter((e) => e instanceof ScannedClass) as ScannedClass[];
  }

  async function getClasses(filename: string) {
    const analysis = await analyzer.analyze([filename]);
    const classes = Array.from(analysis.getFeatures({kind: 'class'}));
    return {classes, analysis};
  }

  async function getTestProps(class_: ScannedClass|Class) {
    type TestPropsType = {
      name: string | undefined,
      description: string,
      privacy: string,
      properties?: any[],
      methods?: any[],
      warnings?: ReadonlyArray<string>,
      mixins?: any[],
      superClass?: string,
    };
    const result: TestPropsType = {
      name: class_.name,
      description: class_.description,
      privacy: class_.privacy
    };
    if (class_.properties.size > 0) {
      result.properties = [];
      for (const {name} of class_.properties.values()) {
        result.properties.push({name});
      }
    }
    if (class_.methods.size > 0) {
      result.methods = [];
      for (const m of class_.methods.values()) {
        const method: any = {name: m.name, description: m.description};
        if (m.params && m.params.length > 0) {
          method.params = m.params.map((p) => {
            const param: any = {name: p.name};
            if (p.description != null) {
              param.description = p.description;
            }
            if (p.type != null) {
              param.type = p.type;
            }
            if (p.defaultValue != null) {
              param.defaultValue = p.defaultValue;
            }
            if (p.rest != null) {
              param.rest = p.rest;
            }
            return param;
          });
        }
        if (m.return ) {
          method.return = m.return;
        }
        const maybeMethod = m as Partial<Method>;
        if (maybeMethod.inheritedFrom) {
          method.inheritedFrom = maybeMethod.inheritedFrom;
        }
        result.methods.push(method);
      }
    }
    if (class_.mixins.length > 0) {
      result.mixins = [];
      for (const {identifier} of class_.mixins) {
        result.mixins.push({identifier});
      }
    }
    if (class_.warnings.length > 0) {
      result.warnings = await underliner.underline(class_.warnings);
    }
    if (class_.superClass) {
      result.superClass = class_.superClass.identifier;
    }
    return result;
  }

  suite('scanning', () => {
    test('finds classes and their names and comment blocks', async () => {
      const classes = await getScannedClasses('class/class-names.js');
      assert.deepEqual(classes.map((c) => c.name), [
        'Declaration',
        'VarDeclaration',
        'Assignment',
        'Namespace.AlsoAssignment',
        'Declared.AnotherAssignment',
        'ClassWithNoJsDoc',
        'ExportedClass',
        undefined,
        'ExportedConstClass',
      ]);

      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Declaration',
          description: 'A simple declaration',
          privacy: 'public',
        },
        {
          description: 'The variable\'s name is used.',
          name: 'VarDeclaration',
          privacy: 'public',
        },
        {
          description: 'The left hand side of the assignment is used.',
          name: 'Assignment',
          privacy: 'public',
        },
        {
          description: 'Namespaced assignments work too',
          name: 'Namespace.AlsoAssignment',
          privacy: 'public',
        },
        {
          description: 'Declared namespace works too',
          name: 'Declared.AnotherAssignment',
          privacy: 'public',
        },
        {
          description: '',
          name: 'ClassWithNoJsDoc',
          privacy: 'public',
        },
        {
          description: 'An exported class.',
          name: 'ExportedClass',
          privacy: 'public',
          methods:
              [{description: '', name: 'method1', return: {type: 'void'}}]
        },
        {
          description: 'A default exported class.',
          name: undefined,
          privacy: 'public',
          methods:
              [{description: '', name: 'method2', return: {type: 'void'}}]
        },
        {
          description: '',
          name: 'ExportedConstClass',
          privacy: 'public',
          methods:
              [{description: '', name: 'method3', return: {type: 'void'}}]
        }
      ]);
    });

    test('finds properties', async () => {
      const cls = (await getScannedClasses('class/class-properties.js'))[0];

      assert.deepInclude(cls.properties.get('customPropertyGetterType'), {
        name: 'customPropertyGetterType',
        type: 'boolean',
        description: 'A boolean getter',
        readOnly: true
      });

      assert.deepInclude(cls.properties.get('customPropertyWithGetterSetter'), {
        name: 'customPropertyWithGetterSetter',
        description: 'a property with a getter/setter',
        readOnly: false
      });

      assert.deepInclude(
          cls.properties.get('customPropertyWithReadOnlyGetter'),
          {name: 'customPropertyWithReadOnlyGetter', readOnly: true});

      assert.deepInclude(
          cls.properties.get('customPropertyOnProto'),
          {name: 'customPropertyOnProto', type: 'string'});

      assert.deepInclude(
          cls.properties.get('customPropertyOnProtoValue'),
          {name: 'customPropertyOnProtoValue', type: 'number'});

      assert.deepInclude(cls.properties.get('customPropertyOnProtoDoc'), {
        name: 'customPropertyOnProtoDoc',
        description: 'A property',
        type: '(boolean | number)',
        privacy: 'private',
        readOnly: true
      });

      assert.deepInclude(
          cls.properties.get('__customPropertyOnProtoPrivate'),
          {name: '__customPropertyOnProtoPrivate', privacy: 'private'});

      assert.deepEqual(await getTestProps(cls), {
        name: 'Class',
        description: '',
        privacy: 'public',
        properties: [
          {name: 'customPropertyWithValue'},
          {name: 'customPropertyWithJSDoc'},
          {name: 'customPropertyGetter'},
          {name: 'customPropertyGetterType'},
          {name: 'customPropertyWithGetterSetter'},
          {name: 'customPropertyWithSetterFirst'},
          {name: 'customPropertyWithReadOnlyGetter'},
          {name: 'customPropertyOnProto'},
          {name: 'customPropertyOnProtoValue'},
          {name: 'customPropertyOnProtoDoc'},
          {name: '__customPropertyOnProtoPrivate'}
        ]
      });
    });

    test('finds methods', async () => {
      const classes = await getScannedClasses('class/class-methods.js');
      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Class',
          description: '',
          privacy: 'public',
          properties: [{name: 'customInstanceGetter'}],
          methods: [
            {
              name: 'customInstanceFunction',
              description: '',
            },
            {
              name: 'methodWithDefaultParam',
              description: '',
              params: [{name: 'x', defaultValue: '12'}],
            },
            {
              name: 'methodWithComplexDefaultParam',
              description: '',
              params: [{name: 'a', defaultValue: '[1, 2, 3]'}],
              return: {type: 'void'}
            },
            {
              name: 'customInstanceFunctionWithJSDoc',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithJSDoc.',
              return: {
                desc: 'The number 5, always.',
                type: 'Number',
              },
            },
            {
              name: 'customInstanceFunctionWithParams',
              description: '',
              params: [{name: 'a'}, {name: 'b'}, {name: 'c'}],
            },
            {
              name: 'customInstanceFunctionWithParamsAndJSDoc',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithParamsAndJSDoc.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument',
                },
                {
                  name: 'b',
                  type: 'Number',
                },
                {
                  name: 'c',
                  type: 'Number',
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
            },
            {
              name: 'customInstanceFunctionWithRestParam',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithRestParam.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument.',
                },
                {
                  name: 'b',
                  type: '...Number',
                  rest: true,
                  description: 'The second argument.',
                }
              ],
              return: {
                desc: 'The number 9, always.',
                type: 'Number',
              },
            },
            {
              name: 'customInstanceFunctionWithParamDefault',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithParamDefault.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument.',
                },
                {
                  name: 'b',
                  type: 'Number',
                  defaultValue: '0',
                  description: 'The second argument.',
                }
              ],
              return: {
                desc: 'The number 10, always.',
                type: 'Number',
              },
            },
            {
              description: undefined,
              name: 'customInstanceFunctionOnProto',
              params: [{description: 'a bool', name: 'foo', type: 'boolean'}],
              return: {type: 'void'}
            },
            {
              description: undefined,
              name: '__customInstanceFunctionOnProtoPrivate'
            },
            {
              description: undefined,
              name: 'customInstanceFunctionOnProtoWithBody'
            },
            {
              description: 'Returns the sum of two numbers',
              name: 'customInstanceFunctionOnProtoWithBodyDoc',
              params: [
                {description: 'some number', name: 'a', type: 'number'},
                {description: 'another number', name: 'b', type: 'number'}
              ],
              return: {type: 'number'}
            },
          ]
        },
      ]);
    });

    test('deals with super classes correctly', async () => {
      const classes = await getScannedClasses('class/super-class.js');

      assert.deepEqual(classes.map((f) => f.name), ['Base', 'Subclass']);
      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Base',
          description: '',
          privacy: 'public',
          methods: [
            {
              description: 'This is a base method.',
              name: 'baseMethod',
              return: {type: 'void'},
            },
            {
              description: 'Will be overriden by Subclass.',
              name: 'overriddenMethod',
              return: {type: 'void'},
            }
          ]
        },
        {
          name: 'Subclass',
          description: '',
          privacy: 'public',
          superClass: 'Base',
          methods: [
            {
              description: 'Overrides the method on Base.',
              name: 'overriddenMethod',
              return: {type: 'void'},
            },
            {
              description: 'This method only exists on Subclass.',
              name: 'subMethod',
              return: {type: 'void'},
            }
          ]
        }
      ]);
    });

    const testName =
        'does not produce duplicate classes for elements or mixins';
    test(testName, async () => {
      const scannedFeatures =
          await getScannedFeatures('class/more-specific-classes.js');

      // Ensures no duplicates
      assert.deepEqual(
          scannedFeatures.map((f) => (f as any).name),
          ['Element', 'AnnotatedElement', 'Mixin', 'AnnotatedMixin']);

      // Ensures we get the more specific types
      // TODO(rictic): these should probably not be Polymer specific.
      assert.deepEqual(scannedFeatures.map((f) => f.constructor.name), [
        'ScannedPolymerElement',
        'ScannedPolymerElement',
        'ScannedPolymerElementMixin',
        'ScannedPolymerElementMixin'
      ]);
    });
  });

  suite('resolving', () => {
    test('finds classes and their names and descriptions', async () => {
      const {classes} = await getClasses('class/class-names.js');
      assert.deepEqual(classes.map((c) => c.name), [
        'Declaration',
        'VarDeclaration',
        'Assignment',
        'Namespace.AlsoAssignment',
        'Declared.AnotherAssignment',
        'ClassWithNoJsDoc',
        'ExportedClass',
        undefined,
        'ExportedConstClass',
      ]);

      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Declaration',
          description: 'A simple declaration',
          privacy: 'public',
        },
        {
          description: 'The variable\'s name is used.',
          name: 'VarDeclaration',
          privacy: 'public',
        },
        {
          description: 'The left hand side of the assignment is used.',
          name: 'Assignment',
          privacy: 'public',
        },
        {
          description: 'Namespaced assignments work too',
          name: 'Namespace.AlsoAssignment',
          privacy: 'public',
        },
        {
          description: 'Declared namespace works too',
          name: 'Declared.AnotherAssignment',
          privacy: 'public',
        },
        {
          description: '',
          name: 'ClassWithNoJsDoc',
          privacy: 'public',
        },
        {
          description: 'An exported class.',
          name: 'ExportedClass',
          privacy: 'public',
          methods:
              [{description: '', name: 'method1', return: {type: 'void'}}]
        },
        {
          description: 'A default exported class.',
          name: undefined,
          privacy: 'public',
          methods:
              [{description: '', name: 'method2', return: {type: 'void'}}]
        },
        {
          description: '',
          name: 'ExportedConstClass',
          privacy: 'public',
          methods:
              [{description: '', name: 'method3', return: {type: 'void'}}]
        }
      ]);
    });

    test('finds methods', async () => {
      const {classes} = await getClasses('class/class-methods.js');
      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Class',
          description: '',
          privacy: 'public',
          properties: [{name: 'customInstanceGetter'}],
          methods: [
            {
              name: 'customInstanceFunction',
              description: '',
            },
            {
              name: 'methodWithDefaultParam',
              description: '',
              params: [{name: 'x', defaultValue: '12'}],
            },
            {
              name: 'methodWithComplexDefaultParam',
              description: '',
              params: [{name: 'a', defaultValue: '[1, 2, 3]'}],
              return: {type: 'void'}
            },
            {
              name: 'customInstanceFunctionWithJSDoc',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithJSDoc.',
              return: {
                desc: 'The number 5, always.',
                type: 'Number',
              },
            },
            {
              name: 'customInstanceFunctionWithParams',
              description: '',
              params: [{name: 'a'}, {name: 'b'}, {name: 'c'}],
            },
            {
              name: 'customInstanceFunctionWithParamsAndJSDoc',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithParamsAndJSDoc.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument',
                },
                {
                  name: 'b',
                  type: 'Number',
                },
                {
                  name: 'c',
                  type: 'Number',
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
            },
            {
              name: 'customInstanceFunctionWithRestParam',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithRestParam.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument.',
                },
                {
                  name: 'b',
                  type: '...Number',
                  rest: true,
                  description: 'The second argument.',
                }
              ],
              return: {
                desc: 'The number 9, always.',
                type: 'Number',
              },
            },
            {
              name: 'customInstanceFunctionWithParamDefault',
              description: 'This is the description for ' +
                  'customInstanceFunctionWithParamDefault.',
              params: [
                {
                  name: 'a',
                  type: 'Number',
                  description: 'The first argument.',
                },
                {
                  name: 'b',
                  type: 'Number',
                  defaultValue: '0',
                  description: 'The second argument.',
                }
              ],
              return: {
                desc: 'The number 10, always.',
                type: 'Number',
              },
            },
            {
              description: undefined,
              name: 'customInstanceFunctionOnProto',
              params: [{description: 'a bool', name: 'foo', type: 'boolean'}],
              return: {type: 'void'}
            },
            {
              description: undefined,
              name: '__customInstanceFunctionOnProtoPrivate'
            },
            {
              description: undefined,
              name: 'customInstanceFunctionOnProtoWithBody'
            },
            {
              description: 'Returns the sum of two numbers',
              name: 'customInstanceFunctionOnProtoWithBodyDoc',
              params: [
                {description: 'some number', name: 'a', type: 'number'},
                {description: 'another number', name: 'b', type: 'number'}
              ],
              return: {type: 'number'}
            },
          ]
        },
      ]);
    });

    test('deals with super classes correctly', async () => {
      const {classes} = await getClasses('class/super-class.js');

      assert.deepEqual(classes.map((f) => f.name), ['Base', 'Subclass']);
      assert.deepEqual(await Promise.all(classes.map((c) => getTestProps(c))), [
        {
          name: 'Base',
          description: '',
          privacy: 'public',
          methods: [
            {
              description: 'This is a base method.',
              name: 'baseMethod',
              return: {type: 'void'},
            },
            {
              description: 'Will be overriden by Subclass.',
              name: 'overriddenMethod',
              return: {type: 'void'},
            }
          ]
        },
        {
          name: 'Subclass',
          description: '',
          privacy: 'public',
          superClass: 'Base',
          methods: [
            {
              description: 'This is a base method.',
              name: 'baseMethod',
              inheritedFrom: 'Base',
              return: {type: 'void'},
            },
            {
              description: 'Overrides the method on Base.',
              name: 'overriddenMethod',
              return: {type: 'void'},
            },
            {
              description: 'This method only exists on Subclass.',
              name: 'subMethod',
              return: {type: 'void'},
            },
          ]
        }
      ]);
    });

    const testName =
        'does not produce duplicate classes for elements or mixins';
    test(testName, async () => {
      const features = (await analyzer.analyze([
                         'class/more-specific-classes.js'
                       ])).getFeatures();
      const interestingFeatures =
          Array.from(features).filter(
              (f) => f instanceof Element || f instanceof ElementMixin ||
                  f instanceof Class) as Array<Element|ElementMixin|Class>;

      // Ensures no duplicates
      assert.deepEqual(
          interestingFeatures.map((f) => f.name),
          ['Element', 'AnnotatedElement', 'Mixin', 'AnnotatedMixin']);

      // Ensures we get the more specific types
      // TODO(rictic): these should probably not be Polymer specific.
      assert.deepEqual(interestingFeatures.map((f) => f.constructor.name), [
        'PolymerElement',
        'PolymerElement',
        'PolymerElementMixin',
        'PolymerElementMixin'
      ]);
    });

    test('we index classes by their canonical statements', async () => {
      const filename = 'class/class-names.js';
      const {classes, analysis} = await getClasses(filename);
      assert.deepEqual(
          classes.map((c) => c.statementAst && c.statementAst.type), [
            'ClassDeclaration',
            'VariableDeclaration',
            'ExpressionStatement',
            'ExpressionStatement',
            'ExpressionStatement',
            'ClassDeclaration',
            'ExportNamedDeclaration',
            'ExportDefaultDeclaration',
            'ExportNamedDeclaration'
          ]);

      const result = analysis.getDocument(filename);
      if (result.successful === false) {
        throw new Error('Could not get document');
      }
      const document = result.value;
      for (const class_ of classes) {
        const features = document.getFeatures(
            {statement: class_.statementAst, kind: 'class'});
        assert.deepEqual([...features].map((c) => c.name), [class_.name]);
      }
    });

    test('we resolve superclasses by scope when possible', async () => {
      const filename = 'class/super-class-scoped.js';
      const {classes} = await getClasses(filename);
      assert.deepEqual(classes.map((c) => c.name), [
        'Foo',
        'Foo',
        'One',
        'Foo',
        'Two',
        'Three',
      ]);

      const subclasses = classes.filter((c) => c.superClass !== undefined);
      assert.deepEqual(
          subclasses.map(((c) => c.name)), ['One', 'Two', 'Three']);

      // Despite the fact that their superclasses all have the same name,
      // we're able to use JS scoping rules to resolve them to the correct
      // referant.
      assert.deepEqual(
          subclasses.map((c) => [...c.methods.keys()]),
          [['method1'], ['method2'], ['method3']]);
    });

    test('we resolve imported super classes', async () => {
      const filename = 'class/super-class-imported.js';
      const analysis = await analyzer.analyze([filename]);
      const result = analysis.getDocument(filename);
      if (result.successful === false) {
        throw new Error('Could not get document');
      }
      const document = result.value;
      const classes = Array.from(document.getFeatures({kind: 'class'}));
      assert.deepEqual(classes.map((c) => c.name), [
        'CL1',
        'CL2',
        'CL3',
        'CL4',
        'CL5',
        'CL6',
      ]);

      assert.deepEqual(classes.map((c) => [...c.methods.keys()]), [
        ['method1'],
        ['method2'],
        ['method3'],
        ['method1'],
        ['method1'],
        ['method1']
      ]);
    });
  });
});
