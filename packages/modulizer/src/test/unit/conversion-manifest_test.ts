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
import {readJson} from 'fs-extra';
import * as path from 'path';
import {Analyzer, FsUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';

import {filesJsonObjectToMap, serializePackageScanResult} from '../../conversion-manifest';
import {WorkspaceUrlHandler} from '../../urls/workspace-url-handler';

const workspaceDir = __dirname;
const manifestsDir = path.join(__dirname, '../../../fixtures/manifests');

suite('src/conversion-manifest', () => {
  let analyzer: Analyzer;
  let urlHandler: WorkspaceUrlHandler;

  beforeEach(() => {
    const urlResolver = new PackageUrlResolver({packageDir: workspaceDir});
    const urlLoader =
        new InMemoryOverlayUrlLoader(new FsUrlLoader(workspaceDir));
    analyzer = new Analyzer({
      urlLoader,
      urlResolver,
    });
    urlHandler = new WorkspaceUrlHandler(analyzer, workspaceDir);
  });

  suite('serializePackageScanResult()', () => {
    test(
        'serialize a basic package scan result to a JSON manifest',
        async () => {
          const scanResultJson =
              await readJson(path.join(manifestsDir, 'simple_expected.json'));
          const expectedManifestResult =
              await readJson(path.join(manifestsDir, 'simple_source.json'));
          const actualResult = serializePackageScanResult(
              new Map(scanResultJson[0]),
              new Map(scanResultJson[1]),
              urlHandler);
          assert.deepEqual(actualResult, expectedManifestResult);
        });
  });

  suite('filesJsonObjectToMap()', () => {
    test(
        'deserialize a basic package scan JSON manifest to a scan result',
        async () => {
          const manifestJson =
              await readJson(path.join(manifestsDir, 'simple_source.json'));
          const expectedResult =
              await readJson(path.join(manifestsDir, 'simple_expected.json'));
          const actualResult = filesJsonObjectToMap(
              'paper-behaviors',
              '@polymer/paper-behaviors',
              manifestJson,
              urlHandler);
          assert.deepEqual([...actualResult[0]], expectedResult[0]);
          assert.deepEqual([...actualResult[1]], expectedResult[1]);
        });

    test(
        '`convertedFilePath` is generated from `convertedUrl`, not `originalUrl`.',
        async () => {
          const manifestJson =
              await readJson(path.join(manifestsDir, 'renaming_source.json'));
          const expectedResult =
              await readJson(path.join(manifestsDir, 'renaming_expected.json'));
          const actualResult = filesJsonObjectToMap(
              'some-package',
              '@some-owner/some-package',
              manifestJson,
              urlHandler);
          assert.deepEqual([...actualResult[0]], expectedResult[0]);
          assert.deepEqual([...actualResult[1]], expectedResult[1]);
        });
  });
});
