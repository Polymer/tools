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

import {Analyzer} from '../analyzer';
import {generateElementMetadata, validateElements, ValidationError} from '../generate-elements';
import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';

const onlyTests = new Set<string>([]);  // Should be empty when not debugging.

// TODO(rictic): work out how we want to handle ignoring elements from other
//     packages in the world of Document rather than Analysis.
const skipTests = new Set<string>(['bower_packages', 'nested-packages']);


suite('elements.json generation', function() {
  const basedir = path.join(__dirname, 'static', 'analysis');
  const analysisFixtureDirs = fs.readdirSync(basedir)
                                  .map(p => path.join(basedir, p))
                                  .filter(p => fs.statSync(p).isDirectory());

  for (const analysisFixtureDir of analysisFixtureDirs) {
    // Generate a test from the goldens found in every dir in
    // src/test/static/analysis/
    const testBaseName = path.basename(analysisFixtureDir);
    const testDefiner = onlyTests.has(testBaseName) ?
        test.only :
        skipTests.has(testBaseName) ? test.skip : test;
    const testName = `produces a correct elements.json ` +
        `for fixture dir \`${testBaseName}\``;

    testDefiner(testName, async function() {
      // Test body here:
      const elements = await analyzeDir(analysisFixtureDir);

      const packages = new Set<string>(mapI(
          filterI(
              walkRecursively(analysisFixtureDir),
              (p) => p.endsWith('bower.json') || p.endsWith('package.json')),
          (p) => path.dirname(p)));
      if (packages.size === 0) {
        packages.add(analysisFixtureDir);
      }
      for (const packagePath of packages) {
        const pathToGolden = path.join(packagePath || '', 'elements.json');
        const renormedPackagePath = packagePath ?
            packagePath.substring(analysisFixtureDir.length + 1) :
            packagePath;
        const analyzedPackages =
            generateElementMetadata(elements, renormedPackagePath);
        validateElements(analyzedPackages);

        try {
          assert.deepEqual(
              analyzedPackages,
              JSON.parse(fs.readFileSync(pathToGolden, 'utf-8')),
              `Generated form of ${path.relative(__dirname, pathToGolden)} ` +
                  `differs from the golden at that path`);
        } catch (e) {
          console.log(
              `Expected contents of ${pathToGolden}:\n` +
              `${JSON.stringify(analyzedPackages, null, 2)}`);
          throw e;
        }
      }
    });
  }

  test('throws when validating valid elements.json', function() {
    try {
      validateElements(<any>{});
    } catch (err) {
      assert.instanceOf(err, ValidationError);
      let valError: ValidationError = err;
      assert(valError.errors.length > 0);
      assert.include(valError.message, `requires property "elements"`);
      return;
    }
    throw new Error('expected Analysis validation to fail!');
  });

  test(`doesn't throw when validating a valid elements.json`, function() {
    validateElements({elements: [], schema_version: '1.0.0'});
  });

  test(`doesn't throw when validating a version from the future`, function() {
    validateElements(
        <any>{elements: [], schema_version: '1.0.1', new_field: 'stuff here'});
  });

  test(`throws when validating a bad version`, function() {
    try {
      validateElements(<any>{
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

async function analyzeDir(baseDir: string) {
  const analyzer = new Analyzer({
    urlLoader: new FSUrlLoader(baseDir),
    urlResolver: new PackageUrlResolver(),
  });
  let importStatements =
      Array.from(filterI(walkRecursively(baseDir), (f) => f.endsWith('.html')))
          .map(
              fn => `<link rel="import" href="${path.relative(baseDir, fn)}">`);
  const document = await analyzer.analyze(
      path.join('ephemeral.html'), importStatements.join('\n'));
  return Array.from(document.getByKind('element'));
}
