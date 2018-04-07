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
import * as ts from 'typescript';

import {AnalysisContext} from '../../core/analysis-context';
import {neverCancels} from '../../core/cancel-token';
import {PackageRelativeUrl} from '../../index';
import {ResolvedUrl} from '../../model/url';
import {TypeScriptAnalyzer} from '../../typescript/typescript-analyzer';
import {TypeScriptPreparser} from '../../typescript/typescript-preparser';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';

async function getTypeScriptAnalyzer(files: Map<PackageRelativeUrl, string>) {
  const urlLoader = new InMemoryOverlayUrlLoader();
  const urlResolver = new PackageUrlResolver();
  for (const [url, contents] of files) {
    urlLoader.urlContentsMap.set(
        urlResolver.resolve('' as any, url as any)!, contents);
  }
  const analysisContext = new AnalysisContext({
    parsers: new Map([['ts', new TypeScriptPreparser()]]),
    urlLoader,
    urlResolver
  });
  // This puts documents into the scanned document cache
  await Promise.all(Object.keys(files).map(
      (url) => analysisContext.scan(url as ResolvedUrl, neverCancels)));
  return new TypeScriptAnalyzer(analysisContext);
}

suite('TypeScriptParser', () => {
  suite('parse()', () => {
    test('parses classes', async () => {
      const fileName = 'typescript/test.ts' as PackageRelativeUrl;
      const typescriptAnalyzer = await getTypeScriptAnalyzer(new Map([[
        fileName,
        `
          class A extends HTMLElement {
            foo() { return 'bar'; }
          }`
      ]]));
      const program = typescriptAnalyzer.analyze(fileName);
      const checker = program.getTypeChecker();

      assert.deepEqual(program.getRootFileNames(), [fileName]);

      // Get the HTMLElement type from the DOM module
      let htmlElement: ts.Type;
      const domSource = program.getSourceFile('/$lib/DOM.d.ts')!;
      ts.forEachChild(domSource, (node) => {
        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
          const innerface = node as ts.InterfaceDeclaration;
          if (innerface.name.getText() === 'HTMLElement') {
            htmlElement = checker.getTypeAtLocation(innerface);
          }
        }
      });

      // Get class A and assert that it extends HTMLElement
      const sourceFile = program.getSourceFile(fileName)!;
      ts.forEachChild(sourceFile, (node) => {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
          const class_ = node as ts.ClassDeclaration;
          if (class_.name && class_.name.getText() === 'A') {
            const type = checker.getTypeAtLocation(class_) as ts.InterfaceType;
            const baseTypes = checker.getBaseTypes(type);
            assert.include(baseTypes, htmlElement);
            const properties = checker.getPropertiesOfType(type);
            const ownProperties = properties.filter(
                (p) => p.getDeclarations()!.some((d) => d.parent === class_));
            assert.equal(ownProperties.length, 1);
            assert.equal(ownProperties[0].name, 'foo');
          }
        }
      });
    });
  });
});
