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

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ScannedFeature} from '../../model/model';
import {ScannedPolymerElementMixin} from '../../polymer/polymer-element-mixin';
import {Polymer2MixinScanner} from '../../polymer/polymer2-mixin-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {CodeUnderliner} from '../test-utils';

suite('Polymer2MixinScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/polymer2/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getMixins(filename: string):
      Promise<ScannedPolymerElementMixin[]> {
        const file = await urlLoader.load(filename);
        const parser = new JavaScriptParser();
        const document = parser.parse(file, filename);
        const scanner = new Polymer2MixinScanner();
        const visit = (visitor: Visitor) =>
            Promise.resolve(document.visit([visitor]));

        const features: ScannedFeature[] = await scanner.scan(document, visit);
        return <ScannedPolymerElementMixin[]>features.filter(
            (e) => e instanceof ScannedPolymerElementMixin);
      };

  function getTestProps(mixin: ScannedPolymerElementMixin): any {
    return {
      name: mixin.name,
      description: mixin.description,
      summary: mixin.summary,
      properties: mixin.properties.map((p) => ({
                                         name: p.name,
                                       })),
      attributes: mixin.attributes.map((a) => ({
                                         name: a.name,
                                       })),
      methods: mixin.methods.map(
          (m) => ({name: m.name, params: m.params, return: m.return })),
    };
  }

  test('finds mixin function declarations', async() => {
    const mixins = await getMixins('test-mixin-1.js');
    const mixinData = mixins.map(getTestProps);
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
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.equal(underlinedSource, `
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

  test('finds mixin arrow function expressions', async() => {
    const mixins = await getMixins('test-mixin-2.js');
    const mixinData = mixins.map(getTestProps);
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
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.equal(underlinedSource, `
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

  test('finds mixin function expressions', async() => {
    const mixins = await getMixins('test-mixin-3.js');
    const mixinData = mixins.map(getTestProps);
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
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.equal(underlinedSource, `
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
      async() => {
        const mixins = await getMixins('test-mixin-4.js');
        const mixinData = mixins.map(getTestProps);
        assert.deepEqual(mixinData, [{
                           name: 'Polymer.TestMixin',
                           description: '',
                           summary: '',
                           properties: [],
                           attributes: [],
                           methods: [],
                         }]);
        const underlinedSource =
            await underliner.underline(mixins[0].sourceRange);
        assert.equal(underlinedSource, `
let TestMixin;
~~~~~~~~~~~~~~`);
      });

  test('what to do on a class marked @polymerMixin?', async() => {
    const mixins = await getMixins('test-mixin-5.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, []);
  });

  test('finds mixin function declaration with only name', async() => {
    const mixins = await getMixins('test-mixin-6.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [{
                       name: 'Polymer.TestMixin',
                       description: '',
                       summary: '',
                       properties: [],
                       attributes: [],
                       methods: [],
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.equal(underlinedSource, `
function TestMixin() {
~~~~~~~~~~~~~~~~~~~~~~
}
~`);
  });

  test('finds mixin assigned to a namespace', async() => {
    const mixins = await getMixins('test-mixin-7.js');
    const mixinData = mixins.map(getTestProps);
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
                     }]);
    const underlinedSource = await underliner.underline(mixins[0].sourceRange);
    assert.equal(underlinedSource, `
Polymer.TestMixin = Polymer.woohoo(function TestMixin(base) {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  /** @polymerMixinClass */
~~~~~~~~~~~~~~~~~~~~~~~~~~~
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
      async() => {
        const mixins = await getMixins('test-mixin-8.js');
        const mixinData = mixins.map(getTestProps);
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
                         }]);

      });

  test('properly analyzes mixin instance and class methods', async() => {
    const mixins = await getMixins('test-mixin-9.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [
      {
        name: 'TestMixin',
        description: 'A mixin description',
        summary: 'A mixin summary',
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
            params: [], return: undefined,
          },
          {
            name: 'customInstanceFunctionWithParams',
            params: [{name: 'a'}, {name: 'b'}, {name: 'c'}], return: undefined,
          },
          {
            name: 'customInstanceFunctionWithParamsAndJSDoc',
            params: [{name: 'a'}, {name: 'b'}, {name: 'c'}], return: undefined,
          },
          {
            name: 'customInstanceFunctionWithParamsAndPrivateJSDoc',
            params: [], return: undefined,
          },
        ],
      }
    ]);

  });

});
