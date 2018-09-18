/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import {extendInterfaces} from './extend.js';

interface TestFixture extends HTMLElement {
  create(model: object): HTMLElement;
  restore(): void;
}

extendInterfaces('fixture', (context, teardown) => {
  // Return context.fixture if it is already a thing, for backwards
  // compatibility with `test-fixture-mocha.js`:
  return context.fixture || function fixture(fixtureId: string, model: object) {
    // Automatically register a teardown callback that will restore the
    // test-fixture:
    teardown(() => {
      (document.getElementById(fixtureId) as TestFixture).restore();
    });

    // Find the test-fixture with the provided ID and create it, returning
    // the results:
    return (document.getElementById(fixtureId) as TestFixture).create(model);
  };
});
