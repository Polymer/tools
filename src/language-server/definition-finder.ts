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
import {Analysis, Analyzer, Document, SourcePosition, SourceRange} from 'polymer-analyzer';
import {CssCustomPropertyAssignment, CssCustomPropertyUse} from 'polymer-analyzer/lib/css/css-custom-property-scanner';
import {Queryable} from 'polymer-analyzer/lib/model/queryable';
import {CodeLens, CodeLensParams, Definition, IConnection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
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

    this.connection.onCodeLens(async(params) => {
      return this.handleErrors(this.getCodeLenses(params), []);
    });
  }

  /**
   * Return the location or locations where the symbol referenced at the given
   * location is defined.
   *
   * Implements:
   * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_definition
   */
  private async getDefinition(
      textPosition: TextDocumentPositionParams,
      analysis?: Analysis): Promise<Location[]> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const sourceRanges = await this.getDefinitionsForFeatureAtPosition(
        localPath, this.converter.convertPosition(textPosition.position),
        analysis);
    return sourceRanges.map(sr => {
      let definition: Location = {
        uri: this.converter.getUriForLocalPath(sr.file),
        range: this.converter.convertPRangeToL(sr)
      };
      return definition;
    });
  }

  private async getDefinitionsForFeatureAtPosition(
      localPath: string, position: SourcePosition,
      analysis?: Analysis): Promise<SourceRange[]> {
    const featureResult =
        await this.featureFinder.getFeatureAt(localPath, position, analysis);
    if (!featureResult) {
      return [];
    }
    const {feature} = featureResult;
    if (feature instanceof CssCustomPropertyUse ||
        feature instanceof CssCustomPropertyAssignment) {
      const analysis = await this.analyzer.analyzePackage();
      const assignments = analysis.getFeatures({
        kind: 'css-custom-property-assignment',
        id: feature.name,
        externalPackages: true
      });
      return [...assignments].map(a => a.sourceRange);
    }
    if (feature instanceof DatabindingFeature) {
      if (feature.property && feature.property.sourceRange) {
        return [feature.property.sourceRange];
      }
      return [];
    }
    if (feature.sourceRange) {
      return [feature.sourceRange];
    }
    return [];
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
    const localPath =
        this.converter.getWorkspacePathToFile(params.textDocument);
    const position = this.converter.convertPosition(params.position);
    const analysis = await this.analyzer.analyzePackage();
    if (params.context.includeDeclaration) {
      locations.push(...await this.getDefinition(params, analysis));
    }

    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return locations;
    }
    const astResult =
        await this.featureFinder.getAstAtPosition(document, position);
    if (!astResult) {
      return locations;
    }
    if (astResult.language === 'css') {
      const featureResult =
          this.featureFinder.getFeatureForAstLocation(astResult, position);
      if (featureResult) {
        if (featureResult.feature instanceof CssCustomPropertyAssignment ||
            featureResult.feature instanceof CssCustomPropertyUse) {
          const propertyUses = [...analysis.getFeatures({
            kind: 'css-custom-property-use',
            id: featureResult.feature.name
          })];
          locations.push(...propertyUses.map(f => {
            return {
              uri: this.converter.getUriForLocalPath(f.sourceRange.file),
              range: this.converter.convertPRangeToL(f.sourceRange)
            };
          }));
        }
      }
    } else if (astResult.node.kind === 'tagName') {
      const ranges = [...analysis.getFeatures({
                       kind: 'element-reference',
                       id: astResult.node.element.tagName!,
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
  private async getCodeLenses(params: CodeLensParams) {
    const analysis = await this.analyzer.analyzePackage();
    const path = this.converter.getWorkspacePathToFile(params.textDocument);
    const document = analysis.getDocument(path);
    if (!(document instanceof Document)) {
      return [];
    }
    const lenses: CodeLens[] = [];
    for (const element of document.getFeatures({kind: 'element'})) {
      if (!element.sourceRange || !element.tagName) {
        continue;
      }
      const refs = analysis.getFeatures(
          {kind: 'element-reference', id: element.tagName});
      lenses.push(this.makeLens(
          element.sourceRange,
          `Referenced ${refs.size} place${plural(refs.size)} in HTML.`));
    }
    for (const cssProperty of document.getFeatures(
             {kind: 'css-custom-property-assignment'})) {
      const refs = analysis.getFeatures(
          {kind: 'css-custom-property-use', id: cssProperty.name});
      lenses.push(this.makeLens(
          cssProperty.sourceRange,
          `Read ${refs.size} place${plural(refs.size)}.`));
    }
    return lenses;
  }

  makeLens(sourceRange: SourceRange, message: string): CodeLens {
    const rangeStart = this.converter.convertSourcePosition(sourceRange.start);
    return {
      range: {
        start: rangeStart,
        end: {line: rangeStart.line + 1, character: 0},
      },
      command: {title: message, command: ''}
    };
  }
}

function plural(count: number) {
  return count === 1 ? '' : 's';
}
