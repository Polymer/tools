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
import {mkdirSync} from 'fs';
import {promisify} from 'util';
import path = require('path');
import _rimraf = require('rimraf');

import {NpmPackage} from '../npm';
import exec from '../util/exec';

const rimraf: (dir: string) => void = promisify(_rimraf);


suite('src/npm', function() {
  this.timeout(20 * 1000);

  suite('NpmPackage', () => {
    const npmDir = path.join(__dirname, 'POLYMER_WORKSPACES_NPM_DIR');
    const emptyDir = path.join(__dirname, 'POLYMER_WORKSPACES_EMPTY_NPM_DIR');

    setup(async () => {
      mkdirSync(npmDir);
      mkdirSync(emptyDir);
      await exec(npmDir, `npm`, [`init`, '--force']);
    });

    teardown(async () => {
      await rimraf(npmDir);
      await rimraf(emptyDir);
    });

    suite.skip(
        'npmPackage.whoami()',
        () => {
            // TODO(fks) 10-12-2017: Add tests. Tests skipped due to the
            // complexity of the underlying npm command.
        });

    suite('gitRepo.getPackageManifest()', () => {
      test('returns the parsed package.json for the package', async () => {
        const npmPackage = new NpmPackage(npmDir);
        const packageManifest = await npmPackage.getPackageManifest();
        assert.equal(packageManifest.name, 'POLYMER_WORKSPACES_NPM_DIR');
        assert.equal(packageManifest.version, '1.0.0');
      });

      test('throws a ENOENT error if no package.json file exists', async () => {
        const emptyNpmPackage = new NpmPackage(emptyDir);
        let packageManifest, packageManifestError;
        try {
          packageManifest = await emptyNpmPackage.getPackageManifest();
        } catch (err) {
          packageManifestError = err;
        } finally {
          assert.isUndefined(packageManifest);
          assert.instanceOf(packageManifestError, Error);
          assert.equal(packageManifestError.code, 'ENOENT');
        }
      });
    });

    suite.skip(
        'gitRepo.publishToNpm()',
        () => {
            // TODO(fks) 10-12-2017: Add tests. Tests skipped due to the
            // complexity of the underlying npm command.
        });
  });
});