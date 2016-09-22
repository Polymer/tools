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

import * as parse5 from 'parse5';

import {Analyzer, Options as AnalyzerOptions} from '../analyzer';
import {ParsedHtmlDocument} from '../html/html-document';
import {Document, Element, Property, ScannedProperty, SourceRange} from '../model/model';
import {Warning, WarningCarryingException} from '../warning/warning';

import {AttributeCompletion, EditorService, SourcePosition, TypeaheadCompletion} from './editor-service';

export class LocalEditorService extends EditorService {
  private _analyzer: Analyzer;
  constructor(options: AnalyzerOptions) {
    super();
    this._analyzer = new Analyzer(options);
  }

  async fileChanged(localPath: string, contents?: string): Promise<void> {
    await this._analyzer.analyzeRoot(localPath, contents);
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
      localPath: string, position: SourcePosition): Promise<SourceRange> {
    const feature = await this._getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    return feature.sourceRange;
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    const document = await this._analyzer.analyzeRoot(localPath);
    const location = await this._getLocationResult(document, position);
    if (location.kind === 'tagName' || location.kind === 'text') {
      const elements = Array.from(document.getByKind('element'));
      return {
        kind: 'element-tags',
        elements: elements.map(e => {
          let attributesSpace = e.attributes.length > 0 ? ' ' : '';
          return {
            tagname: e.tagName,
            description: e.description,
            expandTo: location.kind === 'text' ?
                `<${e.tagName}${attributesSpace}></${e.tagName}>` :
                undefined
          };
        })
      };
    } else if (location.kind === 'attribute') {
      const elements = document.getById('element', location.element.nodeName);
      let attributes: AttributeCompletion[] = [];
      for (const element of elements) {
        // A map from the inheritedFrom to a sort prefix.
        let sortPrefixes = new Map<string, string>();
        // Not inherited, that means local! Sort it early.
        sortPrefixes.set(undefined, 'aaa-');
        sortPrefixes.set(null, 'aaa-');
        if (element.superClass) {
          sortPrefixes.set(element.superClass, 'bbb-');
        }
        if (element.extends) {
          sortPrefixes.set(element.extends, 'ccc-');
        }
        attributes = attributes.concat(
            element.attributes
                .map(p => ({
                       name: p.name,
                       description: p.description,
                       type: p.type,
                       inheritedFrom: p.inheritedFrom,
                       sortKey: `${sortPrefixes.get(p.inheritedFrom) ||
                           'ddd-'
                           }` +
                               `${p.name}`
                     }))
                .concat(element.events.map(
                    e => ({
                      name: `on-${e.name}`,
                      description: e.description,
                      type: e.type || 'CustomEvent',
                      inheritedFrom: e.inheritedFrom,
                      sortKey: `eee-${sortPrefixes.get(e.inheritedFrom) ||
                          'ddd-'
                          }` +
                              `on-${e.name}`
                    }))));
      }
      return {kind: 'attributes', attributes};
    };
  }

  async getWarningsForFile(localPath: string): Promise<Warning[]> {
    try {
      const doc = await this._analyzer.analyzeRoot(localPath);
      return doc.getWarnings();
    } catch (e) {
      // This might happen if, e.g. `localPath` has a parse error. In that case
      // we can't construct a valid Document, but we might still be able to give
      // a reasonable warning.
      if (e instanceof WarningCarryingException) {
        const warnException: WarningCarryingException = e;
        return [warnException.warning];
      }
      throw e;
    }
  }

  async _clearCaches() {
    this._analyzer.clearCaches();
  }

  private async _getFeatureAt(localPath: string, position: SourcePosition):
      Promise<Element|Property|undefined> {
    const document = await this._analyzer.analyzeRoot(localPath);
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return document.getOnlyAtId('element', location.element.nodeName);
    } else if (location.kind === 'attribute') {
      const elements = document.getById('element', location.element.nodeName);
      if (elements.size === 0) {
        return;
      }

      return concatMap(elements, (el) => el.attributes)
          .find(at => at.name === location.attribute);
    }
  }

  private async _getLocationResult(
      document: Document, position: SourcePosition) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getLocationInfoForPosition(parsedDocument.ast, position);
  }
}


type LocationResult = LocatedAttribute|LocatedTag|LocatedEndTag|LocatedInText;
interface LocatedAttribute {
  kind: 'attribute';
  attribute: string|null;
  element: parse5.ASTNode;
}
interface LocatedTag {
  kind: 'tagName';
  element: parse5.ASTNode;
}
interface LocatedEndTag {
  kind: 'endTag';
  element: parse5.ASTNode;
}
interface LocatedInText {
  kind: 'text';
}
function getLocationInfoForPosition(
    node: parse5.ASTNode, position: SourcePosition): LocationResult {
  const location = _getLocationInfoForPosition(node, position);
  if (!location) {
    return {kind: 'text'};
  }
  return location;
}
function _getLocationInfoForPosition(
    node: parse5.ASTNode, position: SourcePosition): undefined|LocationResult {
  if (node.__location) {
    const location = node.__location;
    if (isElementLocationInfo(location)) {
      // Early exit examining this node if the position we're interested in
      // is beyond the end tag of the element.
      if (location.endTag.line - 1 < position.line) {
        return;
      }
      if (isPositionInsideLocation(position, location.startTag)) {
        // Ok we're definitely in this start tag, now the question is whether
        // we're in an attribute or the tag itself.
        if (position.column <
            location.startTag.col + node.nodeName.length + 1) {
          return {kind: 'tagName', element: node};
        }
        for (const attrName in location.startTag.attrs) {
          const attributeLocation = location.startTag.attrs[attrName];
          if (isPositionInsideLocation(position, attributeLocation)) {
            return {kind: 'attribute', attribute: attrName, element: node};
          }
        }
        // We're in the attributes section, but not over any particular
        // attribute.
        return {kind: 'attribute', attribute: null, element: node};
      }
      if (isPositionInsideLocation(position, location.endTag)) {
        return {kind: 'endTag', element: node};
      }
    } else if (node.nodeName && isPositionInsideLocation(position, location)) {
      if (position.column < location.col + node.nodeName.length + 1) {
        return {kind: 'tagName', element: node};
      }
      return {kind: 'attribute', attribute: null, element: node};
    }
  }
  for (const child of node.childNodes || []) {
    const result = _getLocationInfoForPosition(child, position);
    if (result) {
      return result;
    }
  }
}

function isPositionInsideLocation(
    position: SourcePosition, location: parse5.LocationInfo): boolean {
  // wrong line
  if (location.line - 1 !== position.line) {
    return false;
  }
  // position is before this location starts
  if (position.column < location.col) {
    return false;
  }
  // position is after this location ends
  if (position.column >
      location.col + (location.endOffset - location.startOffset)) {
    return false;
  }
  return true;
}

function isElementLocationInfo(location: parse5.LocationInfo|
                               parse5.ElementLocationInfo):
    location is parse5.ElementLocationInfo {
  return location['startTag'] && location['endTag'];
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
