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
import {PolymerElementMixin, ScannedPolymerElementMixin} from '../../polymer/polymer-element-mixin';
import {CodeUnderliner, createForDirectory, fixtureDir, runScanner} from '../test-utils';

suite('Polymer2MixinScanner with old jsdoc annotations', () => {
  let analyzer: Analyzer;
  let underliner: CodeUnderliner;
  before(async () => {
    const testFilesDir = path.resolve(fixtureDir, 'polymer2-old-jsdoc/');
    ({analyzer, underliner} = await createForDirectory(testFilesDir));
  });

  async function getScannedMixins(filename: string) {
    const {features} = await runScanner(analyzer, new ClassScanner(), filename);
    return <ScannedPolymerElementMixin[]>features.filter(
        (e) => e instanceof ScannedPolymerElementMixin);
  }

  async function getMixins(filename: string) {
    const analysis = await analyzer.analyze([filename]);
    return Array.from(analysis.getFeatures({kind: 'polymer-element-mixin'}));
  }

  async function getTestProps(mixin: ScannedPolymerElementMixin|
                              PolymerElementMixin) {
    const properties = [];
    for (const name of mixin.properties.keys()) {
      properties.push({name});
    }
    const attributes = [];
    for (const name of mixin.attributes.keys()) {
      attributes.push({name});
    }
    const methods = [];
    for (const {name, params, return: r} of mixin.methods.values()) {
      let processedParams = undefined;
      if (params) {
        processedParams = params.map(({name, type, description}) => {
          const result:
              {name: string, type?: string, description?: string} = {name};
          if (type != null) {
            result.type = type;
          }
          if (description != null) {
            result.description = description;
          }
          return result;
        });
      }
      methods.push({name, return: r, params: processedParams});
    }
    const {name, description, summary} = mixin;
    return {
      name,
      description,
      summary,
      properties,
      attributes,
      methods,
      underlinedWarnings: await underliner.underline(mixin.warnings)
    };
  }

  test('finds mixin function declarations', async () => {
    const mixins = await getScannedMixins('test-mixin-1.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [{
                       name: 'TestMixin',
                       description: 'A mixin description',
                       summary: 'A mixin summary',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                       methods: [],
                       underlinedWarnings: []
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.deepEqual(underlinedSource, `
function TestMixin(superclass) {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  return class extends superclass {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    static get properties() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      return {
~~~~~~~~~~~~~~
        foo: {
~~~~~~~~~~~~~~
          notify: true,
~~~~~~~~~~~~~~~~~~~~~~~
          type: String,
~~~~~~~~~~~~~~~~~~~~~~~
        },
~~~~~~~~~~
      };
~~~~~~~~
    }
~~~~~
  }
~~~
}
~`);
  });

  test('finds mixin arrow function expressions', async () => {
    const mixins = await getScannedMixins('test-mixin-2.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [{
                       name: 'Polymer.TestMixin',
                       description: 'A mixin description',
                       summary: 'A mixin summary',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                       methods: [],
                       underlinedWarnings: []
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.deepEqual(underlinedSource, `
const TestMixin = (superclass) => class extends superclass {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
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

  test('finds mixin function expressions', async () => {
    const mixins = await getScannedMixins('test-mixin-3.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [{
                       name: 'Polymer.TestMixin',
                       description: '',
                       summary: '',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                       methods: [],
                       underlinedWarnings: [],
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.deepEqual(underlinedSource, `
const TestMixin = function(superclass) {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  return class extends superclass {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    static get properties() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      return {
~~~~~~~~~~~~~~
        foo: {
~~~~~~~~~~~~~~
          notify: true,
~~~~~~~~~~~~~~~~~~~~~~~
          type: String,
~~~~~~~~~~~~~~~~~~~~~~~
        },
~~~~~~~~~~
      };
~~~~~~~~
    }
~~~~~
  }
~~~
}
~`);
  });

  test(
      'finds mixin variable declaration with only name, does not use trailing function',
      async () => {
        const mixins = await getScannedMixins('test-mixin-4.js');
        const mixinData = await Promise.all(mixins.map(getTestProps));
        assert.deepEqual(mixinData, [{
                           name: 'Polymer.TestMixin',
                           description: '',
                           summary: '',
                           properties: [],
                           attributes: [],
                           methods: [],
                           underlinedWarnings: [],
                         }]);
        const underlinedSource =
            await underliner.underline(mixins[0].sourceRange);
        assert.deepEqual(underlinedSource, `
let TestMixin;
~~~~~~~~~~~~~~`);
      });

  test('what to do on a class marked @mixinFunction?', async () => {
    const mixins = await getScannedMixins('test-mixin-5.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, []);
  });

  test('finds mixin function declaration with only name', async () => {
    const mixins = await getScannedMixins('test-mixin-6.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [{
                       name: 'Polymer.TestMixin',
                       description: '',
                       summary: '',
                       properties: [],
                       attributes: [],
                       methods: [],
                       underlinedWarnings: []
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.deepEqual(underlinedSource, `
function TestMixin() {
~~~~~~~~~~~~~~~~~~~~~~
}
~`);
  });

  test('finds mixin assigned to a namespace', async () => {
    const mixins = await getScannedMixins('test-mixin-7.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [{
                       name: 'Polymer.TestMixin',
                       description: '',
                       summary: '',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                       methods: [],
                       underlinedWarnings: [],
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.deepEqual(underlinedSource, `
Polymer.TestMixin = Polymer.woohoo(function TestMixin(base) {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  /**
~~~~~
   * @polymerMixinClass
~~~~~~~~~~~~~~~~~~~~~~~
   */
~~~~~
  class TestMixin extends base {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    static get properties() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      return {
~~~~~~~~~~~~~~
        foo: {
~~~~~~~~~~~~~~
          notify: true,
~~~~~~~~~~~~~~~~~~~~~~~
          type: String,
~~~~~~~~~~~~~~~~~~~~~~~
        },
~~~~~~~~~~
      };
~~~~~~~~
    };
~~~~~~
  };
~~~~
  return TestMixin;
~~~~~~~~~~~~~~~~~~~
});
~~`);
  });

  test(
      'properly analyzes nested mixin assignments with memberof tags',
      async () => {
        const mixins = await getScannedMixins('test-mixin-8.js');
        const mixinData = await Promise.all(mixins.map(getTestProps));
        assert.deepEqual(mixinData, [{
                           name: 'Polymer.TestMixin',
                           description: '',
                           summary: '',
                           properties: [{
                             name: 'foo',
                           }],
                           attributes: [{
                             name: 'foo',
                           }],
                           methods: [],
                           underlinedWarnings: [],
                         }]);
      });

  test('properly analyzes mixin instance and class methods', async () => {
    const mixins = await getScannedMixins('test-mixin-9.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(
        mixinData, [{
          name: 'TestMixin',
          description: 'A mixin description',
          summary: 'A mixin summary',
          properties: [{name: 'customInstanceGetter'}, {name: 'foo'}],
          attributes: [{
            name: 'foo',
          }],
          methods: [
            {name: 'customInstanceFunction', params: [], return: undefined},
            {
              name: 'customInstanceFunctionWithJSDoc',
              params: [],
              return: {
                desc: 'The number 5, always.',
                type: 'Number',
              },
            },
            {
              name: 'customInstanceFunctionWithParams',
              params: [{name: 'a'}, {name: 'b'}, {name: 'c'}],
              return: undefined,
            },
            {
              name: 'customInstanceFunctionWithParamsAndJSDoc',
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
              params: [],
              return: undefined,
            },
          ],
          underlinedWarnings: [],
        }]);
  });

  test('applies mixins to mixins', async () => {
    const mixins = await getMixins('test-mixin-10.js');
    const mixinData = await Promise.all(mixins.map(getTestProps));
    assert.deepEqual(mixinData, [
      {
        name: 'Base',
        description: '',
        summary: '',
        attributes: [{name: 'foo'}],
        methods: [
          {name: 'baseMethod', params: [], return: {type: 'void'}},
          {name: 'privateMethod', params: [], return: {type: 'void'}},
          {name: 'privateOverriddenMethod', params: [], return: {type: 'void'}},
          {name: 'overrideMethod', params: [], return: {type: 'void'}},
        ],
        properties: [{name: 'foo'}],
        underlinedWarnings: [],
      },
      {
        name: 'Middle',
        attributes: [{name: 'foo'}],
        description: '',
        methods: [
          {name: 'baseMethod', params: [], return: {type: 'void'}},
          {name: 'privateMethod', params: [], return: {type: 'void'}},
          {name: 'privateOverriddenMethod', params: [], return: {type: 'void'}},
          {name: 'overrideMethod', params: [], return: {type: 'void'}},
          {name: 'middleMethod', params: [], return: {type: 'void'}},
        ],
        properties: [{name: 'foo'}],
        summary: '',
        underlinedWarnings: [`
    privateOverriddenMethod() { }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`],
      }
    ]);
  });
});
