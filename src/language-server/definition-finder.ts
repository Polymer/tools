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

import {SourcePosition, SourceRange} from 'polymer-analyzer';
import {Definition, IConnection, Location} from 'vscode-languageserver';
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
      private featureFinder: FeatureFinder) {
    super();

    this.connection.onDefinition(async(textPosition) => {
      return this.handleErrors(
          this.getDefinition(textPosition), undefined) as Promise<Definition>;
    });
  }

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

  async getDefinitionForFeatureAtPosition(
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
}
