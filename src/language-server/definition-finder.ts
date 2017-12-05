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

import * as fuzzaldrin from 'fuzzaldrin';
import {Analyzer, Document, SourcePosition, SourceRange} from 'polymer-analyzer';
import {Queryable} from 'polymer-analyzer/lib/model/queryable';
import {Definition, IConnection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import {TextDocumentPositionParams} from 'vscode-languageserver-protocol';

import AnalyzerLSPConverter from './converter';
import FeatureFinder, {DatabindingFeature} from './feature-finder';
import {Handler} from './util';


/**
 * Gets the definition of a feature at a position.
 */
export default class DefinitionFinder extends Handler {
  constructor(
      protected connection: IConnection,
      private converter: AnalyzerLSPConverter,
      private featureFinder: FeatureFinder, private analyzer: Analyzer) {
    super();

    this.connection.onDefinition(async(textPosition) => {
      return this.handleErrors(
          this.getDefinition(textPosition), undefined) as Promise<Definition>;
    });

    this.connection.onReferences(async(params) => {
      return this.handleErrors(this.getReferences(params), []);
    });

    this.connection.onWorkspaceSymbol(async(params) => {
      const analysis = await this.analyzer.analyzePackage();
      const symbols = this.findSymbols(analysis);
      return fuzzaldrin.filter(symbols, params.query, {key: 'name'});
    });

    this.connection.onDocumentSymbol(async(params) => {
      const localPath = converter.getWorkspacePathToFile(params.textDocument);
      const analysis = await this.analyzer.analyze([localPath]);
      const maybeDocument = analysis.getDocument(localPath);
      if (!(maybeDocument instanceof Document)) {
        return [];
      }
      return this.findSymbols(maybeDocument);
    });
  }

  /**
   * Return the location or locations where the symbol referenced at the given
   * location is defined.
   *
   * Implements:
   * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_definition
   */
  private async getDefinition(textPosition: TextDocumentPositionParams):
      Promise<Definition|undefined> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const location = await this.getDefinitionForFeatureAtPosition(
        localPath, this.converter.convertPosition(textPosition.position));
    if (location && location.file) {
      let definition: Location = {
        uri: this.converter.getUriForLocalPath(location.file),
        range: this.converter.convertPRangeToL(location)
      };
      return definition;
    }
  }

  private async getDefinitionForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange|undefined> {
    const feature = await this.featureFinder.getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    if (feature instanceof DatabindingFeature) {
      return feature.property && feature.property.sourceRange;
    }
    return feature.sourceRange;
  }

  /**
   * Get all places that the symbol being referenced at the given place is
   * referenced in the package.
   *
   * Implements:
   * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_references
   */
  private async getReferences(params: ReferenceParams): Promise<Location[]> {
    const locations: Location[] = [];
    if (params.context.includeDeclaration) {
      const definition = await this.getDefinition(params);
      if (definition) {
        if (Array.isArray(definition)) {
          locations.push(...definition);
        } else {
          locations.push(definition);
        }
      }
    }
    const localPath =
        this.converter.getWorkspacePathToFile(params.textDocument);
    const position = this.converter.convertPosition(params.position);
    const analysis = await this.analyzer.analyzePackage();
    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return locations;
    }
    const location =
        await this.featureFinder.getAstAtPosition(document, position);
    if (!location) {
      return locations;
    }
    if (location.kind === 'tagName') {
      const ranges = [...analysis.getFeatures({
                       kind: 'element-reference',
                       id: location.element.tagName!,
                       externalPackages: true,
                     })].map(e => e.sourceRange);
      locations.push(...ranges.map(r => {
        return {
          uri: this.converter.getUriForLocalPath(r.file),
          range: this.converter.convertPRangeToL(r)
        };
      }));
    }

    return locations;
  }

  private findSymbols(queryable: Queryable): SymbolInformation[] {
    // Most kinds of symbols are covered by JS and TS analyzers. We can
    // help track down custom elements by tag name though.
    const symbols: SymbolInformation[] = [];
    const elements =
        queryable.getFeatures({kind: 'element', externalPackages: true});
    for (const element of elements) {
      if (!element.sourceRange) {
        continue;
      }
      if (element.tagName) {
        symbols.push({
          kind: SymbolKind.Class,
          location: this.converter.getLocation(element.sourceRange),
          name: element.tagName
        });
      }
    }
    const polymerCoreFeatures = queryable.getFeatures(
        {kind: 'polymer-core-feature', externalPackages: true});
    for (const coreFeature of polymerCoreFeatures) {
      if (!coreFeature.sourceRange) {
        continue;
      }
      for (const identifier of coreFeature.identifiers) {
        symbols.push({
          kind: SymbolKind.Method,
          location: this.converter.getLocation(coreFeature.sourceRange),
          name: identifier
        });
      }
    }
    return symbols;
  }
}
