import {assert} from 'chai';

import * as ts from '../ts-ast';

suite('serializeTsDeclarations', () => {
  test('property', () => {
    const p = new ts.Property({
      name: 'myProperty',
      type: new ts.NameType('string'),
    });
    assert.equal(p.serialize(), 'myProperty: string;\n');
  });

  test('property with unsafe name', () => {
    const p = new ts.Property({
      name: 'my-unsafe-property',
      type: new ts.NameType('string'),
    });
    assert.equal(p.serialize(), '"my-unsafe-property": string;\n');
  });

  test('property with custom tag', () => {
    const p = new ts.Property({
      name: 'myProperty',
      tags: [{ title: 'attr', description: '{string} my-property' }],
      type: new ts.NameType('string'),
    });
    assert.equal(p.serialize(), `
/**
 * @attr {string} my-property
 */
myProperty: string;
`);
  });

  test('property with description and custom tag', () => {
    const p = new ts.Property({
      name: 'myProperty',
      tags: [{ title: 'attr', description: '{string} my-property' }],
      type: new ts.NameType('string'),
    });
    p.description = 'This is my property.\nIt has a multi-line description.';
    assert.equal(p.serialize(), `
/**
 * This is my property.
 * It has a multi-line description.
 * @attr {string} my-property
 */
myProperty: string;
`);
  });

  test('function with description', () => {
    const m = new ts.Function({
      name: 'MyMethod',
      returns: new ts.NameType('boolean'),
    });
    m.description = 'This is my function.\nIt has a multi-line description.';
    m.params = [
      new ts.ParamType({name: 'param1', type: new ts.NameType('string')}),
      new ts.ParamType(
          {name: 'param2', type: new ts.NameType('any'), optional: true}),
      new ts.ParamType({
        name: 'param3',
        type: new ts.ArrayType(new ts.NameType('number')),
        rest: true
      }),
    ];
    assert.equal(m.serialize(), `
/**
 * This is my function.
 * It has a multi-line description.
 */
declare function MyMethod(param1: string, param2?: any, ...param3: number[]): boolean;
`);
  });

  test('interface', () => {
    const i = new ts.Interface({
      name: 'MyInterface',
      description: 'Description of MyInterface.',
      extends: ['MyBase1', 'MyBase2'],
      properties: [
        new ts.Property({
          name: 'myProperty1',
          description: 'Description of myProperty1.',
          type: new ts.NameType('string'),
        }),
        new ts.Property({
          name: 'myProperty2',
          description: 'Description of myProperty2.',
          type: new ts.NameType('any'),
        }),
      ],
      methods: [
        new ts.Method({name: 'MyMethod1', returns: new ts.NameType('boolean')}),
        new ts.Method({name: 'MyMethod2', returns: new ts.NameType('any')}),
      ],
    });
    assert.equal(i.serialize(), `/**
 * Description of MyInterface.
 */
interface MyInterface extends MyBase1, MyBase2 {

  /**
   * Description of myProperty1.
   */
  myProperty1: string;

  /**
   * Description of myProperty2.
   */
  myProperty2: any;
  MyMethod1(): boolean;
  MyMethod2(): any;
}
`);
  });

  test('class', () => {
    const c = new ts.Class({name: 'MyClass'});
    c.description = 'Description of MyClass.';
    c.extends = 'MyBase';
    c.properties = [
      new ts.Property({
        name: 'myProperty1',
        type: new ts.NameType('string'),
      }),
      new ts.Property({
        name: 'myProperty2',
        type: new ts.NameType('any'),
      }),
    ];
    c.methods = [
      new ts.Method({name: 'MyMethod1', returns: new ts.NameType('boolean')}),
      new ts.Method({name: 'MyMethod2', returns: new ts.NameType('any')}),
    ];
    assert.equal(c.serialize(), `/**
 * Description of MyClass.
 */
declare class MyClass extends MyBase {
  myProperty1: string;
  myProperty2: any;
  MyMethod1(): boolean;
  MyMethod2(): any;
}
`);
  });

  test('class mixins', () => {
    const c = new ts.Class({name: 'MyClass'});
    c.extends = 'MyBase';
    c.mixins = ['Mixin1', 'Mixin2'];
    c.properties = [
      new ts.Property({
        name: 'myProperty',
        type: new ts.NameType('string'),
      }),
    ];
    assert.equal(c.serialize(), `declare class MyClass extends
  Mixin1(
  Mixin2(
  MyBase)) {
  myProperty: string;
}
`);
  });

  test('document', () => {
    const d = new ts.Document({
      path: 'my-document.d.ts',
      members: [
        new ts.Interface({name: 'MyInterface'}),
        new ts.Class({name: 'MyClass'}),
      ],
      referencePaths: [
        './other-types.d.ts',
        '../more/types.d.ts',
      ],
      tsLintDisables: [{ruleName: 'dumb-jokes', why: 'just ignore him'}]
    });
    assert.equal(d.serialize(), `
// tslint:disable:dumb-jokes just ignore him

/// <reference path="./other-types.d.ts" />
/// <reference path="../more/types.d.ts" />

interface MyInterface {
}

declare class MyClass {
}
`);
  });

  test('namespace', () => {
    const n = new ts.Namespace({
      name: 'MyNamespace',
      members: [
        new ts.Interface({name: 'MyInterface'}),
      ]
    });
    assert.equal(n.serialize(), `declare namespace MyNamespace {

  interface MyInterface {
  }
}
`);
  });

  test('deep namespace', () => {
    const n = new ts.Namespace({
      name: 'MyNamespace1',
      members: [
        new ts.Namespace({
          name: 'MyNamespace2',
          members: [
            new ts.Namespace({
              name: 'MyNamespace3',
              members: [
                new ts.Interface({name: 'MyInterface'}),
              ]
            }),
          ]
        }),
      ]
    });
    assert.equal(n.serialize(), `declare namespace MyNamespace1 {

  namespace MyNamespace2 {

    namespace MyNamespace3 {

      interface MyInterface {
      }
    }
  }
}
`);
  });

  suite('import', () => {
    test('with aliases', () => {
      const n = new ts.Import({
        identifiers: [
          {identifier: 'Foo'},
          {identifier: 'Bar', alias: 'BarAlias'},
          {identifier: 'Baz', alias: 'Baz'},
        ],
        fromModuleSpecifier: './foo.js',
      });
      assert.equal(
          n.serialize(),
          `import {Foo, Bar as BarAlias, Baz} from './foo.js';\n`);
    });

    test('namespace', () => {
      const n = new ts.Import({
        identifiers: [
          {identifier: ts.AllIdentifiers, alias: 'foo'},
        ],
        fromModuleSpecifier: './foo.js',
      });
      assert.equal(n.serialize(), `import * as foo from './foo.js';\n`);
    });

    test('default and namespace', () => {
      const n = new ts.Import({
        identifiers: [
          {identifier: 'default', alias: 'foo'},
          {identifier: ts.AllIdentifiers, alias: 'bar'},
        ],
        fromModuleSpecifier: './foo.js',
      });
      assert.equal(n.serialize(), `import foo, * as bar from './foo.js';\n`);
    });
  });

  suite('export', () => {
    test('locals with aliases', () => {
      const n = new ts.Export({
        identifiers: [
          {identifier: 'Foo'},
          {identifier: 'Bar', alias: 'BarAlias'},
          {identifier: 'Baz', alias: 'Baz'},
        ]
      });
      assert.equal(n.serialize(), `export {Foo, Bar as BarAlias, Baz};\n`);
    });

    test('re-export all', () => {
      const n = new ts.Export({
        identifiers: ts.AllIdentifiers,
        fromModuleSpecifier: './foo.js',
      });
      assert.equal(n.serialize(), `export * from './foo.js';\n`);
    });
  });
});
