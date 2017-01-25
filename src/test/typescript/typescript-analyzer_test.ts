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
import {TypeScriptAnalyzer} from '../../typescript/typescript-analyzer';
import {UrlLoader} from '../../url-loader/url-loader';
import {UrlResolver} from '../../url-loader/url-resolver';

class TestUrlResolver implements UrlResolver {
  canResolve(url: string) {
    return url === '/typescript/test.ts';
  }

  resolve(url: string) {
    return url;
  }
}

class TestUrlLoader implements UrlLoader {
  canLoad(url: string) {
    return url === '/typescript/test.ts';
  }

  load(url: string): Promise<string> {
    if (url === '/typescript/test.ts') {
      return Promise.resolve(`
class A extends HTMLElement {
  foo() { return 'bar'; }
}
`);
    } else {
      throw new Error(`cannot load file ${url}`);
    }
  }
}

suite('TypeScriptParser', () => {
  let typescriptAnalyzer: TypeScriptAnalyzer;
  let analysisContext: AnalysisContext;

  setup(() => {
    const urlLoader = new TestUrlLoader();
    const urlResolver = new TestUrlResolver();
    analysisContext = new AnalysisContext({urlLoader, urlResolver});
    typescriptAnalyzer = new TypeScriptAnalyzer(analysisContext);
  });

  suite('parse()', () => {

    test('parses classes', async() => {
      const fileName = '/typescript/test.ts';
      // This puts a document into the scanned document cache
      await analysisContext.scan(fileName);
      const program = typescriptAnalyzer.analyze(fileName);
      const checker = program.getTypeChecker();

      assert.deepEqual(program.getRootFileNames(), [fileName]);

      // Get the HTMLElement type from the DOM module
      let htmlElement: ts.Type;
      const domSource = program.getSourceFile('/$lib/DOM.d.ts');
      ts.forEachChild(domSource, (node) => {
        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
          const innerface = node as ts.InterfaceDeclaration;
          if (innerface.name.getText() === 'HTMLElement') {
            htmlElement = checker.getTypeAtLocation(innerface);
          }
        }
      });

      // Get class A and assert that it extends HTMLElement
      const sourceFile = program.getSourceFile(fileName);
      ts.forEachChild(sourceFile, (node) => {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
          const clazz = node as ts.ClassDeclaration;
          if (clazz.name && clazz.name.getText() === 'A') {
            const type = checker.getTypeAtLocation(clazz) as ts.InterfaceType;
            const baseTypes = checker.getBaseTypes(type);
            assert.include(baseTypes, htmlElement);
            const properties = checker.getPropertiesOfType(type);
            const ownProperties = properties.filter(
                (p) => p.getDeclarations().some((d) => d.parent === clazz));
            assert.equal(ownProperties.length, 1);
            assert.equal(ownProperties[0].name, 'foo');
          }
        }
      });
    });
  });

});
