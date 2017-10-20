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

  test('function with description', () => {
    const method: Function = {
      kind: 'function',
      name: 'MyMethod',
      description: 'This is my function.\nIt has a multi-line description.',
      params: [
        {
          kind: 'param',
          name: 'param1',
          type: 'string',
          optional: false,
        },
        {
          kind: 'param',
          name: 'param2',
          type: 'any',
          optional: true,
        },
      ],
      returns: 'boolean',
    };
    assert.equal(serializeTsDeclarations(method), `
/**
 * This is my function.
 * It has a multi-line description.
 */
declare function MyMethod(param1: string, param2?: any): boolean;
`);
  });

  test('interface', () => {
    const i: Interface = {
      kind: 'interface',
      name: 'MyInterface',
      description: 'Description of MyInterface.',
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
          kind: 'method',
          name: 'MyMethod1',
          description: '',
          params: [],
          returns: 'boolean',
        },
        {
          kind: 'method',
          name: 'MyMethod2',
          description: '',
          params: [],
          returns: 'any',
        },
      ],
    };
    assert.equal(serializeTsDeclarations(i), `/**
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
    const c: Class = {
      kind: 'class',
      name: 'MyClass',
      description: 'Description of MyClass.',
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
          kind: 'method',
          name: 'MyMethod1',
          description: '',
          params: [],
          returns: 'boolean',
        },
        {
          kind: 'method',
          name: 'MyMethod2',
          description: '',
          params: [],
          returns: 'any',
        },
      ],
    };
    assert.equal(serializeTsDeclarations(c), `/**
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

  test('document', () => {
    assert.equal(
        serializeTsDeclarations({
          kind: 'document',
          path: 'my-document.d.ts',
          members: [
            {
              kind: 'interface',
              name: 'MyInterface',
              description: '',
              extends: [],
              properties: [],
              methods: []
            },
            {
              kind: 'class',
              name: 'MyClass',
              description: '',
              extends: '',
              properties: [],
              methods: []
            },
          ],
        }),
        `interface MyInterface {
}

declare class MyClass {
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
              description: '',
              extends: [],
              properties: [],
              methods: []
            },
          ],
        }),
        `declare namespace MyNamespace {

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
                      description: '',
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
        `declare namespace MyNamespace1 {

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
