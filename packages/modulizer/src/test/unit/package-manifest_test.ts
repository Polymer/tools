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

import {assert} from 'chai';
import {lookupDependencyMapping, saveDependencyMapping} from '../../package-manifest';
import {interceptOutput} from './util';


suite('src/package-manifest', () => {
  suite('lookupDependencyMapping()', () => {
    test('returns undefined when dependency map is not known', async () => {
      const output = await interceptOutput(async () => {
        const result = lookupDependencyMapping('UNKNOWN_PACKAGE_NAME');
        assert.isUndefined(result);
      });
      assert.deepEqual(
          output.trim(),
          `WARN: bower->npm mapping for "UNKNOWN_PACKAGE_NAME" not found`);
    });
    test('returns dependency mapping info when dependency map is known', () => {
      const result = lookupDependencyMapping('polymer');
      assert.deepEqual(result, {
        npm: '@polymer/polymer',
        semver: '^3.0.0',
      });
    });
  });

  suite('saveDependencyMapping()', () => {
    const testName = `saves a dependency mapping for later lookup ` +
        `via lookupDependencyMapping()`;
    test(testName, async () => {
      const output = await interceptOutput(async () => {
        const bowerName = 'CUSTOM_BOWER_PACKAGE_NAME';
        const customMappingInfo = {
          npm: 'CUSTOM_NPM_PACKAGE_NAME',
          semver: '^1.2.3'
        };
        let result = lookupDependencyMapping(bowerName);
        assert.isUndefined(result);
        saveDependencyMapping(
            bowerName, customMappingInfo.npm, customMappingInfo.semver);
        result = lookupDependencyMapping(bowerName);
        assert.deepEqual(result, customMappingInfo);
      });
      assert.deepEqual(
          output.trim(),
          `WARN: bower->npm mapping for "CUSTOM_BOWER_PACKAGE_NAME" not found`);
    });
  });
});
