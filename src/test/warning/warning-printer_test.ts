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
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as memoryStreams from 'memory-streams';
import * as path from 'path';

import {JavaScriptParser} from '../../javascript/javascript-parser';
import {Severity, Warning} from '../../model/model';
import {ResolvedUrl} from '../../model/url';
import {WarningPrinter} from '../../warning/warning-printer';

const parser = new JavaScriptParser();
const staticTestDir = path.join(__dirname, '../static');
const vanillaSources =
    fs.readFileSync(path.join(staticTestDir, 'vanilla-elements.js'), 'utf-8');
const parsedDocument =
    parser.parse(vanillaSources, 'vanilla-elements.js' as ResolvedUrl);

const dumbNameWarning = new Warning({
  message: 'This is a dumb name for an element.',
  code: 'dumb-element-name',
  severity: Severity.WARNING,
  sourceRange: {
    file: 'vanilla-elements.js',
    start: {column: 6, line: 0},
    end: {column: 22, line: 0}
  },
  parsedDocument
});

const goodJobWarning = new Warning({
  message: 'Good job with this observedAttributes getter.',
  code: 'cool-observed-attributes',
  severity: Severity.INFO,
  sourceRange: {
    file: 'vanilla-elements.js',
    start: {line: 22, column: 2},
    end: {line: 29, column: 3}
  },
  parsedDocument
});

suite('WarningPrinter', () => {
  let output: NodeJS.WritableStream;
  let printer: WarningPrinter;
  let originalChalkEnabled: boolean;

  setup(() => {
    output = new memoryStreams.WritableStream();
    printer = new WarningPrinter(output, {color: false});
    originalChalkEnabled = chalk.enabled;
    (chalk as any).enabled = true;
  });

  teardown(() => {
    (chalk as any).enabled = originalChalkEnabled;
  });

  test('can handle printing no warnings', async () => {
    await printer.printWarnings([]);
    assert.deepEqual(output.toString(), '');
  });

  test('can format and print a basic warning', async () => {
    await printer.printWarnings([dumbNameWarning]);
    const actual = output.toString();
    const expected = `

class ClassDeclaration extends HTMLElement {}
      ~~~~~~~~~~~~~~~~

vanilla-elements.js(1,7) warning [dumb-element-name] - This is a dumb name for an element.
`;
    assert.deepEqual(actual, expected);
  });

  test('can format and print one-line warnings', async () => {
    printer = new WarningPrinter(output, {verbosity: 'one-line', color: false});
    await printer.printWarnings([dumbNameWarning]);
    const actual = output.toString();
    const expected =
        `vanilla-elements.js(1,7) warning [dumb-element-name] - This is a dumb name for an element.\n`;
    assert.deepEqual(actual, expected);
  });

  test('it adds color if configured to do so', async () => {
    printer = new WarningPrinter(output, {color: true});
    await printer.printWarnings([dumbNameWarning]);
    const actual = output.toString();
    const expected = `

class ClassDeclaration extends HTMLElement {}
\u001b[33m      ~~~~~~~~~~~~~~~~\u001b[39m

vanilla-elements.js(1,7) \u001b[33mwarning\u001b[39m [dumb-element-name] - This is a dumb name for an element.
`;
    assert.deepEqual(actual, expected);
  });

  test('it can print a multiline range', async () => {
    await printer.printWarnings([goodJobWarning]);
    const actual = output.toString();
    const expected = `

  static get observedAttributes() {
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    return [
~~~~~~~~~~~~
      /** @type {boolean} When given the element is totally inactive */
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      'disabled',
~~~~~~~~~~~~~~~~~
      /** @type {boolean} When given the element is expanded */
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      'open', 'foo', 'bar'
~~~~~~~~~~~~~~~~~~~~~~~~~~
    ];
~~~~~~
  }
~~~

vanilla-elements.js(23,3) info [cool-observed-attributes] - Good job with this observedAttributes getter.
`;
    assert.deepEqual(actual, expected);
  });
});
