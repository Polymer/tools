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

import {Analysis} from '../../analysis-format/analysis-format';
import {generateAnalysis, validateAnalysis, ValidationError} from '../../analysis-format/generate-analysis';
import {Analyzer} from '../../core/analyzer';
import {fileRelativeUrl, fixtureDir} from '../test-utils';

const onlyTests = new Set<string>([]);  // Should be empty when not debugging.

// TODO(rictic): work out how we want to handle ignoring elements from other
//     packages in the world of Document rather than Analysis.
const skipTests = new Set<string>(['bower_packages', 'nested-packages']);


suite('generate-analysis', () => {
  suite('generateAnalysisMetadata', () => {
    suite('generates for Document array from fixtures', () => {
      const basedir = path.join(fixtureDir, 'analysis');
      const analysisFixtureDirs =
          fs.readdirSync(basedir)
              .map((p) => path.join(basedir, p))
              .filter((p) => fs.statSync(p).isDirectory());

      for (const analysisFixtureDir of analysisFixtureDirs) {
        // Generate a test from the goldens found in every dir in
        // src/test/static/analysis/
        const testBaseName = path.basename(analysisFixtureDir);
        const testDefiner = onlyTests.has(testBaseName) ?
            test.only :
            skipTests.has(testBaseName) ? test.skip : test;
        const testName = `produces a correct analysis.json ` +
            `for fixture dir \`${testBaseName}\``;

        testDefiner(testName, async () => {
          // Test body here:
          const {analysis: documents, analyzer} =
              await analyzeDir(analysisFixtureDir);

          const packages = new Set<string>(mapI(
              filterI(
                  walkRecursively(analysisFixtureDir),
                  (p) =>
                      p.endsWith('bower.json') || p.endsWith('package.json')),
              (p) => path.dirname(p)));
          if (packages.size === 0) {
            packages.add(analysisFixtureDir);
          }
          for (const packagePath of packages) {
            const pathToGolden = path.join(packagePath || '', 'analysis.json');
            const analysisWithUndefineds =
                generateAnalysis(documents, analyzer.urlResolver);
            validateAnalysis(analysisWithUndefineds);
            const analysis = JSON.parse(JSON.stringify(analysisWithUndefineds));

            const golden: Analysis =
                JSON.parse(fs.readFileSync(pathToGolden, 'utf-8'));

            try {
              const shortPath = path.relative(fixtureDir, pathToGolden);
              assert.deepEqual(
                  analysis,
                  golden,
                  `Generated form of ${shortPath} ` +
                      `differs from the golden at that path`);
            } catch (e) {
              console.log(
                  `Expected contents of ${pathToGolden}:\n` +
                  `${JSON.stringify(analysis, null, 2)}`);
              throw e;
            }
          }
        });
      }
    });

    suite('generates from package', () => {
      test('does not include external features', async () => {
        const basedir = path.resolve(fixtureDir, 'analysis/bower_packages');
        const analyzer = Analyzer.createForDirectory(basedir);
        const _package = await analyzer.analyzePackage();
        const metadata = generateAnalysis(_package, analyzer.urlResolver);
        // The fixture only contains external elements
        assert.isUndefined(metadata.elements);
      });

      test('includes package features', async () => {
        const basedir = path.resolve(fixtureDir, 'analysis/simple');
        const analyzer = Analyzer.createForDirectory(basedir);
        const _package = await analyzer.analyzePackage();
        const metadata = generateAnalysis(_package, analyzer.urlResolver);
        assert.equal(metadata.elements && metadata.elements.length, 1);
        assert.equal(metadata.elements![0].tagname, 'simple-element');
        assert.equal(
            metadata.elements![0].path, fileRelativeUrl`simple-element.html`);
      });
    });
  });

  suite('validateAnalysis', () => {
    test('throws when validating valid analysis.json', () => {
      try {
        validateAnalysis({} as any);
      } catch (err) {
        assert.instanceOf(err, ValidationError);
        const valError: ValidationError = err;
        assert(valError.errors.length > 0);
        assert.include(valError.message, `requires property "schema_version"`);
        return;
      }
      throw new Error('expected Analysis validation to fail!');
    });

    test(`doesn't throw when validating a valid analysis.json`, () => {
      validateAnalysis({
        elements: [],
        schema_version: '1.0.0',
      });
    });

    test(`doesn't throw when validating a version from the future`, () => {
      validateAnalysis(<any>{
        elements: [],
        schema_version: '1.0.1',
        new_field: 'stuff here'
      });
    });

    test(`throws when validating a bad version`, () => {
      try {
        validateAnalysis(<any>{
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
  const analyzer = Analyzer.createForDirectory(baseDir);
  const allFilenames = Array.from(walkRecursively(baseDir));
  const htmlOrJsFilenames =
      allFilenames.filter((f) => f.endsWith('.html') || f.endsWith('.js'));
  const filePaths =
      htmlOrJsFilenames.map((filename) => path.relative(baseDir, filename));
  const analysis = await analyzer.analyze(filePaths);
  return {analysis, analyzer};
}
