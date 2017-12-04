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

import * as chai from 'chai';
import {assert} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {FSUrlLoader, PackageUrlResolver, UrlLoader} from 'polymer-analyzer';
import {CodeUnderliner} from 'polymer-analyzer/lib/test/test-utils';

import {LocalEditorService} from '../local-editor-service';

chai.use(require('chai-subset'));

function singleFileLoader(
    path: string, contentsGetter: () => string): UrlLoader {
  return {
    canLoad() {
      return true;
    },
    async load(reqPath: string) {
      if (reqPath === path) {
        return contentsGetter();
      }
      throw new Error(`Unknown file: ${reqPath}`);
    }
  };
}

suite('editorService', () => {
  const basedir = path.join(__dirname, 'static');

  let editorService: LocalEditorService;
  setup(async() => {
    editorService = new LocalEditorService({
      urlLoader: new FSUrlLoader(basedir),
      urlResolver: new PackageUrlResolver()
    });
  });

  suite('getReferencesForFeatureAtPosition', function() {

    const contentsPath = path.join('editor-service', 'references.html');
    const contents = fs.readFileSync(path.join(basedir, contentsPath), 'utf-8');
    const underliner =
        new CodeUnderliner(singleFileLoader(contentsPath, () => contents));

    let testName =
        `it supports getting the references to an element from its tag`;
    test(testName, async() => {
      await editorService.fileChanged(contentsPath, `${contents}`);

      let references = (await editorService.getReferencesForFeatureAtPosition(
          contentsPath, {line: 7, column: 3}))!;
      let ranges = await underliner.underline([...references]);
      assert.deepEqual(ranges, [
        `
  <anonymous-class one></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
        `
  <anonymous-class two></anonymous-class>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
      ]);

      references = (await editorService.getReferencesForFeatureAtPosition(
          contentsPath, {line: 8, column: 3}))!;
      ranges = await underliner.underline([...references]);

      assert.deepEqual(ranges, [
        `
  <simple-element one></simple-element>
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
        `
    <simple-element two></simple-element>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
      ]);
    });
  });
});
