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
import {ScannedFeature} from '../../model/model';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

import {CodeUnderliner} from '../test-utils';

suite('FunctionScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/namespaces/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getNamespaceFunctions(filename: string): Promise<any[]> {
    const file = await urlLoader.load(filename);
    const parser = new JavaScriptParser();
    const document = parser.parse(file, filename);
    const scanner = new FunctionScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));
    const features: ScannedFeature[] = await scanner.scan(document, visit);
    return <ScannedFunction[]>features.filter(
        (e) => e instanceof ScannedFunction);
  };


  async function getTestProps(fn: ScannedFunction):
      Promise<any> {
        return {
          name: fn.name,
          description: fn.description,
          summary: fn.summary,
          warnings: fn.warnings,
          params: fn.params, return: fn.return,
          codeSnippet: await underliner.underline(fn.sourceRange),
        };
      }

  test('scans', async() => {
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
        params: [], return: undefined,
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
        params: [], return: undefined,
        codeSnippet: `
  function ccc() {
  ~~~~~~~~~~~~~~~~
  }
~~~`,
      },
      {
        name: 'Polymer.ddd',
        description: 'ddd',
        summary: '',
        warnings: [],
        params: [], return: undefined,
        codeSnippet: `
  ddd: function() {
  ~~~~~~~~~~~~~~~~~


  },
~~~`,
      },
      {
        name: 'Polymer.eee',
        description: 'eee',
        summary: '',
        warnings: [],
        params: [], return: undefined,
        codeSnippet: `
  eee: () => {},
  ~~~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.fff',
        description: 'fff',
        summary: '',
        warnings: [],
        params: [], return: undefined,
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
        params: [], return: undefined,
        codeSnippet: `
  ggg: someFunction,
  ~~~~~~~~~~~~~~~~~`,
      },
      {
        name: 'Polymer.hhh',
        description: 'hhh',
        summary: '',
        warnings: [],
        params: [], return: undefined,
        codeSnippet: `
var hhh = function() {
~~~~~~~~~~~~~~~~~~~~~~


};
~~`,
      }
    ]);
  });
});
