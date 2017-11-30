/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import {ScannedFunction} from '../../javascript/function';
import {FunctionScanner} from '../../javascript/function-scanner';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {CodeUnderliner} from '../test-utils';

suite('FunctionScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/namespaces/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getNamespaceFunctions(filename: string):
      Promise<ScannedFunction[]> {
    const file = await urlLoader.load(filename);
    const parser = new JavaScriptParser();
    const document = parser.parse(file, filename as ResolvedUrl);
    const scanner = new FunctionScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));
    const {features} = await scanner.scan(document, visit);
    return <ScannedFunction[]>features.filter(
        (e) => e instanceof ScannedFunction);
  };


  async function getTestProps(fn: ScannedFunction): Promise<any> {
    return {
      name: fn.name,
      description: fn.description,
      summary: fn.summary,
      warnings: fn.warnings,
      params: fn.params,
      return: fn.return,
      codeSnippet: await underliner.underline(fn.sourceRange),
      privacy: fn.privacy
    };
  }

  test('handles @memberof annotation', async () => {
    const namespaceFunctions =
        await getNamespaceFunctions('memberof-functions.js');
    const functionData =
        await Promise.all(namespaceFunctions.map(getTestProps));
    assert.deepEqual(functionData, [
      {
        name: 'Polymer.aaa',
        description: 'aaa',
        summary: '',
        warnings: [],
        params: [{
          desc: 'This is the first argument',
          name: 'a',
          type: 'Number',
        }],
        privacy: 'public',
        return: undefined,
        codeSnippet: `
function aaa(a) {
~~~~~~~~~~~~~~~~~
  return a;
~~~~~~~~~~~
}
~`,
      },
      {
        name: 'Polymer.bbb',
        description: 'bbb',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'public',
        codeSnippet: `
Polymer.bbb = function bbb() {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


};
~~`,
      },
      {
        name: 'Polymer.ccc',
        description: 'ccc',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'protected',
        codeSnippet: `
  function ccc() {
  ~~~~~~~~~~~~~~~~
  }
~~~`,
      },
      {
        name: 'Polymer._ddd',
        description: 'ddd',
        summary: '',
        warnings: [],
        privacy: 'protected',
        params: [],
        return: undefined,
        codeSnippet: `
  _ddd: function() {
  ~~~~~~~~~~~~~~~~~~


  },
~~~`,
      },
      {
        name: 'Polymer.eee',
        description: 'eee',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'private',
        codeSnippet: `
  eee: () => {},
  ~~~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.fff',
        description: 'fff',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'public',
        codeSnippet: `
  fff() {
  ~~~~~~~


  },
~~~`,
      },
      {
        name: 'Polymer.ggg',
        description: 'ggg',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'public',
        codeSnippet: `
  ggg: someFunction,
  ~~~~~~~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.hhh_',
        description: 'hhh_ should be private',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'private',
        codeSnippet: `
  hhh_: someOtherFunc,
  ~~~~~~~~~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.__iii',
        description: '__iii should be private too',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'private',
        codeSnippet: `
  __iii() { },
  ~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.jjj',
        description: 'jjj',
        summary: '',
        warnings: [],
        params: [],
        return: undefined,
        privacy: 'public',
        codeSnippet: `
var jjj = function() {
~~~~~~~~~~~~~~~~~~~~~~


};
~~`,
      },
    ]);
  });

  test('handles @global, @memberof, @function annotations', async () => {
    const functions = await getNamespaceFunctions('annotated-functions.js');
    assert.deepEqual(functions.map((fn) => fn.name), [
      'globalFn',
      'SomeNamespace.memberofFn',
      'overrideNameFn',
    ]);
  });
});
