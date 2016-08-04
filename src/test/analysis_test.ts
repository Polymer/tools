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
import * as fs from 'fs';
import * as path from 'path';

import {Analysis, ValidationError} from '../analysis';
import {Analyzer} from '../analyzer';
import {ElementDescriptor} from '../ast/ast';
import {Elements} from '../elements-format';
import {generateElementMetadata} from '../generate-elements';
import {FSUrlLoader} from '../url-loader/fs-url-loader';


const onlyTests = new Set<string>([]);  // Should be empty when not debugging.
suite('Analysis', function() {
  const basedir = path.join(__dirname, 'static', 'analysis');
  const analysisFixtureDirs = fs.readdirSync(basedir)
                                  .map(p => path.join(basedir, p))
                                  .filter(p => fs.statSync(p).isDirectory());

  for (const analysisFixtureDir of analysisFixtureDirs) {
    const testBaseName = path.basename(analysisFixtureDir);
    const testDefiner = onlyTests.has(testBaseName) ? test.only : test;
    const testName = `correctly produces a serialized elements.json ` +
        `for fixture dir \`${testBaseName}\``;
    testDefiner(testName, async function() {
      const analysis = await analyzeDir(analysisFixtureDir).resolve();

      const packages = new Set<string>(mapI(
          filterI(
              walkRecursively(analysisFixtureDir),
              (p) => p.endsWith('bower.json') || p.endsWith('package.json')),
          (p) => path.dirname(p)));
      if (packages.size === 0) {
        packages.add(analysisFixtureDir);
      }
      for (const packagePath of packages) {
        const pathToCanonical = path.join(packagePath || '', 'elements.json');
        const renormedPackagePath = packagePath ?
            packagePath.substring(analysisFixtureDir.length + 1) :
            packagePath;
        const analyzedPackages =
            generateElementMetadata(analysis, renormedPackagePath);
        Analysis.validate(analyzedPackages);

        try {
          assert.deepEqual(
              analyzedPackages,
              JSON.parse(fs.readFileSync(pathToCanonical, 'utf-8')));
        } catch (e) {
          console.log(
              `Expected contents of ${pathToCanonical}:\n${JSON.stringify(analyzedPackages, null, 2)}`);
          throw e;
        }
      }
    });
  }

  test('throws when validating a valid AnalyzedPackage', function() {
    try {
      Analysis.validate(<any>{});
    } catch (err) {
      assert.instanceOf(err, ValidationError);
      let valError: ValidationError = err;
      assert(valError.errors.length > 0);
      assert.include(valError.message, `requires property "elements"`);
      return;
    }
    throw new Error('expected Analysis validation to fail!');
  });

  test(`doesn't throw when validating a valid AnalyzedPackage`, function() {
    Analysis.validate({elements: [], schema_version: '1.0.0'});
  });

  test(`doesn't throw when validating a version from the future`, function() {
    Analysis.validate(
        <any>{elements: [], schema_version: '1.0.1', new_field: 'stuff here'});
  });

  test(`throws when validating a bad version`, function() {
    try {
      Analysis.validate(<any>{
        elements: [],
        schema_version: '5.1.1',
        new_field: 'stuff here'
      });
    } catch (e) {
      assert.include(e.message, 'Invalid schema_version in AnalyzedPackage');
      return;
    }
    throw new Error('expected Analysis validation to fail!');
  });

});

function analyzeDir(baseDir: string): Analyzer {
  const analyzer = new Analyzer({urlLoader: new FSUrlLoader(baseDir)});
  for (const filename of walkRecursively(baseDir)) {
    analyzer.analyze(filename.substring(baseDir.length));
  }
  return analyzer;
}

function* filterI<T>(it: Iterable<T>, pred: (t: T) => boolean): Iterable<T> {
  for (const inst of it) {
    if (pred(inst)) {
      yield inst;
    }
  }
}

function* mapI<T, U>(it: Iterable<T>, trans: (t: T) => U): Iterable<U> {
  for (const inst of it) {
    yield trans(inst);
  }
}

function* walkRecursively(dir: string): Iterable<string> {
  for (const filename of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, filename);
    if (fs.statSync(fullPath).isDirectory()) {
      for (const f of walkRecursively(fullPath)) {
        yield f;
      }
    } else {
      yield fullPath;
    }
  }
}