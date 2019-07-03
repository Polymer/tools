/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';
import * as sinon from 'sinon';

import * as polymerInit from '../../../init/init';
import {PolymerCli} from '../../../polymer-cli';

suite('init', () => {
  teardown(() => {
    sinon.restore();
  });

  test('runs the given generator when name argument is provided', async () => {
    const runGeneratorStub =
        sinon.stub(polymerInit, 'runGenerator').returns(Promise.resolve());
    const cli = new PolymerCli(['init', 'shop']);
    await cli.run();
    assert.isOk(runGeneratorStub.calledOnce);
    assert.isOk(runGeneratorStub.calledWith(`polymer-init-shop:app`, {
      name: 'shop',
    }));
  });

  const testName =
      'prompts the user to select a generator when no argument is provided';
  test(testName, async () => {
    const promptSelectionStub =
        sinon.stub(polymerInit, 'promptGeneratorSelection')
            .returns(Promise.resolve());
    const cli = new PolymerCli(['init']);
    await cli.run();
    assert.isOk(promptSelectionStub.calledOnce);
  });
});
