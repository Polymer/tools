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

import {Analyzer, Options as AnalyzerOptions} from '../analyzer';
import {ParsedHtmlDocument} from '../html/html-document';
import {Attribute, Document, Element, Property, ScannedProperty, SourcePosition, SourceRange, Warning} from '../model/model';
import {InMemoryOverlayUrlLoader} from '../url-loader/overlay-loader';

import {getLocationInfoForPosition} from './ast-from-source-position';
import {AttributeCompletion, EditorService, TypeaheadCompletion} from './editor-service';

export class LocalEditorService extends EditorService {
  private readonly _analyzer: Analyzer;
  private readonly _inMemoryOverlay: InMemoryOverlayUrlLoader;
  constructor(options: AnalyzerOptions) {
    super();
    this._inMemoryOverlay = new InMemoryOverlayUrlLoader(options.urlLoader);
    this._analyzer = new Analyzer(
        Object.assign({}, options, {urlLoader: this._inMemoryOverlay}));
  }

  async fileChanged(localPath: string, contents?: string) {
    if (contents == null) {
      this._inMemoryOverlay.urlContentsMap.delete(localPath);
    } else {
      this._inMemoryOverlay.urlContentsMap.set(localPath, contents);
    }
    await this._analyzer.filesChanged([localPath]);
  }

  async getDocumentationAtPosition(localPath: string, position: SourcePosition):
      Promise<string|undefined> {
    const feature = await this._getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    if (isProperty(feature)) {
      if (feature.type) {
        return `{${feature.type}} ${feature.description}`;
      }
    }
    return feature.description;
  }

  async getDefinitionForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange|undefined> {
    const feature = await this._getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    return feature.sourceRange;
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    const documentOrWarning =
        (await this._analyzer.analyze([localPath])).getDocument(localPath);
    if (!(documentOrWarning instanceof Document)) {
      return;
    }
    const document = documentOrWarning;
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName' || location.kind === 'text') {
      const elements =
          Array
              .from(document.getByKind(
                  'element', {imported: true, externalPackages: true}))
              .filter((e) => e.tagName);
      return {
        kind: 'element-tags',
        elements: elements.map((e) => {
          const attributesSpace = e.attributes.length > 0 ? ' ' : '';
          return {
            tagname: e.tagName!,
            description: e.description,
            expandTo: location.kind === 'text' ?
                `<${e.tagName}${attributesSpace}></${e.tagName}>` :
                undefined
          };
        })
      };
    } else if (location.kind === 'attribute') {
      const elements = document.getById(
          'element',
          location.element.nodeName,
          {imported: true, externalPackages: true});
      let attributes: AttributeCompletion[] = [];
      for (const element of elements) {
        // A map from the inheritedFrom to a sort prefix. Note that
        // `undefined` is a legal value for inheritedFrom.
        const sortPrefixes = new Map<string|undefined, string>();
        // Not inherited, that means local! Sort it early.
        sortPrefixes.set(undefined, 'aaa-');
        if (element.superClass) {
          sortPrefixes.set(element.superClass.identifier, 'bbb-');
        }
        if (element.extends) {
          sortPrefixes.set(element.extends, 'ccc-');
        }
        const elementAttributes: AttributeCompletion[] =
            element.attributes.map((p) => {
              const sortKey =
                  (sortPrefixes.get(p.inheritedFrom) || `ddd-`) + p.name;
              return {
                name: p.name,
                description: p.description || '',
                type: p.type,
                inheritedFrom: p.inheritedFrom, sortKey
              };
            });

        const eventAttributes: AttributeCompletion[] =
            element.events.map((e) => {
              const postfix = sortPrefixes.get(e.inheritedFrom) || 'ddd-';
              const sortKey = `eee-${postfix}on-${e.name}`;
              return {
                name: `on-${e.name}`,
                description: e.description || '',
                type: e.type || 'CustomEvent',
                inheritedFrom: e.inheritedFrom, sortKey
              };
            });
        attributes =
            attributes.concat(elementAttributes).concat(eventAttributes);
      }
      return {kind: 'attributes', attributes};
    };
  }

  async getWarningsForFile(localPath: string): Promise<Warning[]> {
    const documentOrWarning =
        (await this._analyzer.analyze([localPath])).getDocument(localPath);
    if (!documentOrWarning) {
      return [];
    }
    if (!(documentOrWarning instanceof Document)) {
      return [documentOrWarning];
    }
    return documentOrWarning.getWarnings();
  }

  async _clearCaches() {
    await this._analyzer.clearCaches();
  }

  private async _getFeatureAt(localPath: string, position: SourcePosition):
      Promise<Element|Property|Attribute|undefined> {
    const documentOrWarning =
        (await this._analyzer.analyze([localPath])).getDocument(localPath);
    if (!(documentOrWarning instanceof Document)) {
      return;
    }
    const document = documentOrWarning;
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return document.getOnlyAtId(
          'element',
          location.element.nodeName,
          {imported: true, externalPackages: true});
    } else if (location.kind === 'attribute') {
      const elements = document.getById(
          'element',
          location.element.nodeName,
          {imported: true, externalPackages: true});
      if (elements.size === 0) {
        return;
      }

      return concatMap(elements, (el) => el.attributes)
          .find((at) => at.name === location.attribute);
    }
  }

  private async _getLocationResult(
      document: Document, position: SourcePosition) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getLocationInfoForPosition(parsedDocument, position);
  }
}



function isProperty(d: any): d is(ScannedProperty | Property) {
  return 'type' in d;
}

function concatMap<I, O>(inputs: Iterable<I>, f: (i: I) => O[]): O[] {
  let results: O[] = [];
  for (const input of inputs) {
    results = results.concat(f(input));
  }
  return results;
}
