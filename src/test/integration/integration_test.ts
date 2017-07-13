import * as fs from 'mz/fs';
import * as path from 'path';
import {Document} from 'polymer-analyzer';
import {configureAnalyzer, configureConverter} from '../../convert-package';
import {assert} from 'chai';


suite('integration tests', function() {

  this.timeout(10 * 1000);

  const fixturesDirPath = path.resolve(__dirname, '../../../fixtures');

  test('case-map', async () => {
    const options = {inDir: fixturesDirPath};
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze(['case-map/case-map.html']);
    const converter = configureConverter(analysis, options);
    const converted = await converter.convert();
    const caseMapSource = converted.get('./case-map/case-map.js');
    assert.include(caseMapSource!, 'export function dashToCamelCase');
    assert.include(caseMapSource!, 'export function camelToDashCase');
  });

  test('polymer-element', async () => {
    const options = {inDir: fixturesDirPath};
    const filename = 'polymer-element/polymer-element.html';
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze([filename]);
    const doc = analysis.getDocument(filename) as Document;
    const converter = configureConverter(analysis, {});
    converter.convertDocument(doc);
    assert(converter.namespacedExports.has('Polymer.Element'));
  });

  test('polymer', async () => {

    const expectedDir = path.join(fixturesDirPath, 'polymer_expected');
    const options = {
      inDir: path.join(fixturesDirPath, 'polymer'),
    };
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyzePackage();
    const converter = configureConverter(analysis, {});
    const results = await converter.convert();
    for (const [jsPath, jsContents] of results) {
      const expectedJsPath = path.resolve(expectedDir, jsPath);
      const expectedJsContents = fs.readFileSync(expectedJsPath, 'utf8');
      assert.equal(jsContents, expectedJsContents);
    }
    // assert(converter.namespacedExports.has('Polymer.Element'));
  });

});
