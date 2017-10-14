import {assert} from 'chai';

import {Class, Function, Interface, Property} from '../ts-ast';
import {serializeTsDeclarations} from '../ts-serialize';

suite('serializeTsDeclarations', () => {
  test('property', () => {
    const property: Property = {
      kind: 'property',
      name: 'myProperty',
      description: '',
      type: 'string',
    };
    assert.equal(serializeTsDeclarations(property), 'myProperty: string;\n');
  });

  test('property with unsafe name', () => {
    const property: Property = {
      kind: 'property',
      name: 'my-unsafe-property',
      description: '',
      type: 'string',
    };
    assert.equal(
        serializeTsDeclarations(property), '"my-unsafe-property": string;\n');
  });

  test('method with description', () => {
    const method: Function = {
      kind: 'function',
      name: 'MyMethod',
      description: 'This is my method.\nIt has a multi-line description.',
      params: [
        {
          kind: 'param',
          name: 'param1',
          type: 'string',
        },
        {
          kind: 'param',
          name: 'param2',
          type: 'any',
        },
      ],
      returns: 'boolean',
    };
    assert.equal(serializeTsDeclarations(method), `
/**
 * This is my method.
 * It has a multi-line description.
 */
MyMethod(param1: string, param2: any): boolean;
`);
  });

  test('interface', () => {
    const i: Interface = {
      kind: 'interface',
      name: 'MyInterface',
      extends: [
        'MyBase1',
        'MyBase2',
      ],
      properties: [
        {
          kind: 'property',
          name: 'myProperty1',
          description: 'Description of myProperty1.',
          type: 'string',
        },
        {
          kind: 'property',
          name: 'myProperty2',
          description: 'Description of myProperty2.',
          type: 'any',
        },
      ],
      methods: [
        {
          kind: 'function',
          name: 'MyMethod1',
          description: '',
          params: [],
          returns: 'boolean',
        },
        {
          kind: 'function',
          name: 'MyMethod2',
          description: '',
          params: [],
          returns: 'any',
        },
      ],
    };
    assert.equal(
        serializeTsDeclarations(i),
        `interface MyInterface extends MyBase1, MyBase2 {

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
    const c: Class = {
      kind: 'class',
      name: 'MyClass',
      extends: 'MyBase',
      properties: [
        {
          kind: 'property',
          name: 'myProperty1',
          description: '',
          type: 'string',
        },
        {
          kind: 'property',
          name: 'myProperty2',
          description: '',
          type: 'any',
        },
      ],
      methods: [
        {
          kind: 'function',
          name: 'MyMethod1',
          description: '',
          params: [],
          returns: 'boolean',
        },
        {
          kind: 'function',
          name: 'MyMethod2',
          description: '',
          params: [],
          returns: 'any',
        },
      ],
    };
    assert.equal(serializeTsDeclarations(c), `class MyClass extends MyBase {
  myProperty1: string;
  myProperty2: any;
  MyMethod1(): boolean;
  MyMethod2(): any;
}
`);
  });

  test('namespace', () => {
    assert.equal(
        serializeTsDeclarations({
          kind: 'namespace',
          name: 'MyNamespace',
          members: [
            {
              kind: 'interface',
              name: 'MyInterface',
              extends: [],
              properties: [],
              methods: []
            },
          ],
        }),
        `namespace MyNamespace {

  interface MyInterface {
  }
}
`);
  });

  test('deep namespace', () => {
    assert.equal(
        serializeTsDeclarations({
          kind: 'namespace',
          name: 'MyNamespace1',
          members: [
            {
              kind: 'namespace',
              name: 'MyNamespace2',
              members: [
                {
                  kind: 'namespace',
                  name: 'MyNamespace3',
                  members: [
                    {
                      kind: 'interface',
                      name: 'MyInterface',
                      extends: [],
                      properties: [],
                      methods: []
                    },
                  ],
                },
              ],
            },
          ],
        }),
        `namespace MyNamespace1 {

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
