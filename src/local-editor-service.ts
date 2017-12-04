/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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
import {Analyzer, AnalyzerOptions, Document, ParsedHtmlDocument, SourcePosition, SourceRange} from 'polymer-analyzer';
import {InMemoryOverlayUrlLoader} from 'polymer-analyzer/lib/url-loader/overlay-loader';

import {getAstLocationForPosition} from './ast-from-source-position';
import Settings from './language-server/settings';

export interface Options extends AnalyzerOptions {
  // TODO(rictic): update tests, make this required.
  settings?: Settings;
}

/**
 * This class provides much of the core functionality of the language server.
 *
 * It's got a slightly weird name and API due to historical reasons. It will
 * soon be carved up into smaller, more focused classes.
 */
export class LocalEditorService {
  readonly analyzer: Analyzer;
  private urlLoader: InMemoryOverlayUrlLoader;
  constructor(options: Options) {
    let urlLoader = options.urlLoader;
    if (!(urlLoader instanceof InMemoryOverlayUrlLoader)) {
      this.urlLoader = new InMemoryOverlayUrlLoader(urlLoader);
    } else {
      this.urlLoader = urlLoader;
    }
    this.analyzer =
        new Analyzer(Object.assign({}, options, {urlLoader: this.urlLoader}));
  }

  async fileChanged(localPath: string, contents?: string): Promise<void> {
    if (contents !== undefined) {
      // Just used in tests, need to remove this.
      this.urlLoader.urlContentsMap.set(localPath, contents);
    }
    await this.analyzer.filesChanged([localPath]);
  }

  async getReferencesForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange[]|undefined> {
    const analysis = await this.analyzer.analyze([localPath]);
    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return;
    }
    const location = await this.getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return [
        ...document.getFeatures({
          kind: 'element-reference',
          id: location.element.tagName!,
          externalPackages: true,
          imported: true
        })
      ].map(e => e.sourceRange);
    }
  }

  private async getAstAtPosition(document: Document, position: SourcePosition) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getAstLocationForPosition(parsedDocument, position);
  }
}
