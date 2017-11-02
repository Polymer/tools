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

  test('function with description', () => {
    const m = new ts.Function({
      name: 'MyMethod',
      returns: new ts.NameType('boolean'),
    });
    m.description = 'This is my function.\nIt has a multi-line description.';
    m.params = [
      new ts.Param('param1', new ts.NameType('string')),
      new ts.Param('param2', new ts.NameType('any'), true),
    ];
    assert.equal(m.serialize(), `
/**
 * This is my function.
 * It has a multi-line description.
 */
declare function MyMethod(param1: string, param2?: any): boolean;
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
    });
    assert.equal(d.serialize(), `/// <reference path="./other-types.d.ts" />
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
});
