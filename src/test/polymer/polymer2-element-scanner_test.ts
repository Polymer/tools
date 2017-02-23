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
import {ScannedPolymerElement} from '../../polymer/polymer-element';
import {Polymer2ElementScanner} from '../../polymer/polymer2-element-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {CodeUnderliner} from '../test-utils';

suite('Polymer2ElementScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/polymer2/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getElements(
      filename: string): Promise<ScannedPolymerElement[]> {
    const file = await urlLoader.load(filename);
    const parser = new JavaScriptParser();
    const document = parser.parse(file, filename);
    const scanner = new Polymer2ElementScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const features = await scanner.scan(document, visit);
    return features.filter(
        (e) => e instanceof ScannedPolymerElement) as ScannedPolymerElement[];
  };

  function getTestProps(element: ScannedPolymerElement): any {
    return {
      className: element.className,
      superClass: element.superClass && element.superClass.identifier,
      tagName: element.tagName,
      description: element.description,
      properties: element.properties.map((p) => ({
                                           name: p.name,
                                         })),
      attributes: element.attributes.map((a) => ({
                                           name: a.name,
                                         })),
    };
  }

  test('Finds two basic elements', async() => {
    const elements = await getElements('test-element-1.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'Polymer.Element',
        description: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
      },
      {
        tagName: undefined,
        className: 'BaseElement',
        superClass: 'Polymer.Element',
        description: '',
        properties: [{
          name: 'foo',
        }],
        attributes: [{
          name: 'foo',
        }],
      },
    ]);

    const underlinedSource1 =
        await underliner.underline(elements[0].sourceRange);
    assert.equal(underlinedSource1, `
class TestElement extends Polymer.Element {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  static get config() {
~~~~~~~~~~~~~~~~~~~~~~~
    return {
~~~~~~~~~~~~
      properties: {
~~~~~~~~~~~~~~~~~~~
        foo: {
~~~~~~~~~~~~~~
          notify: true,
~~~~~~~~~~~~~~~~~~~~~~~
          type: String,
~~~~~~~~~~~~~~~~~~~~~~~
        }
~~~~~~~~~
      },
~~~~~~~~
    };
~~~~~~
  }
~~~
}
~`);

    const underlinedSource2 =
        await underliner.underline(elements[1].sourceRange);
    assert.equal(underlinedSource2, `
class BaseElement extends Polymer.Element {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  static get config() {
~~~~~~~~~~~~~~~~~~~~~~~
    return {
~~~~~~~~~~~~
      properties: {
~~~~~~~~~~~~~~~~~~~
        foo: {
~~~~~~~~~~~~~~
          notify: true,
~~~~~~~~~~~~~~~~~~~~~~~
          type: String,
~~~~~~~~~~~~~~~~~~~~~~~
        }
~~~~~~~~~
      },
~~~~~~~~
    };
~~~~~~
  }
~~~
}
~`);
  });

  test('Uses static is getter for tagName', async() => {
    const elements = await getElements('test-element-2.js');
    const elementData = elements.map(getTestProps);
    assert.deepEqual(elementData, [
      {
        tagName: 'test-element',
        className: 'TestElement',
        superClass: 'HTMLElement',
        description: '',
        properties: [],
        attributes: [],
      },
    ]);
  });

});
