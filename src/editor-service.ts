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

import {Analysis} from './analysis';
import {Analyzer, Options as AnalyzerOptions} from './analyzer';
import {Element, Property, ScannedDocument, ScannedProperty} from './ast/ast';
import {SourceLocation} from './elements-format';
import {ParsedHtmlDocument} from './html/html-document';
import {PolymerElement} from './polymer/element-descriptor';
import {UrlLoader} from './url-loader/url-loader';

export interface Position {
  /** Line number in file, starting from 0. */
  line: number;
  /** Column number in file, starting from 0. */
  column: number;
}

export type TypeaheadCompletion = ElementCompletion | AttributeCompletion;
export interface ElementCompletion {
  kind: 'element-tags';
  elements: {tagname: string, description: string, expandTo?: string}[];
}
export interface AttributeCompletion {
  kind: 'attributes';
  attributes: {
    name: string,
    description: string,
    type: string|undefined,
    sortKey: string;
    inheritedFrom?: string;
  }[];
}

class PermissiveUrlLoader implements UrlLoader {
  private _realLoader: UrlLoader;
  constructor(realLoader: UrlLoader) {
    this._realLoader = realLoader;
  }
  canLoad() {
    return true;
  }
  async load(path: string) {
    try {
      return await this._realLoader.load(path);
    } catch (_) {
      // muddle on!
    }
    return '';
  }
}

export class EditorService {
  private _analyzer: Analyzer;
  constructor(options: AnalyzerOptions) {
    this._analyzer = new Analyzer(Object.assign({}, options, <AnalyzerOptions>{
      urlLoader: new PermissiveUrlLoader(options.urlLoader)
    }));
  }

  async fileChanged(localPath: string, contents?: string):
      Promise<ScannedDocument> {
    return this._analyzer.analyzeChangedFile(localPath, contents);
  }

  async getDocumentationFor(localPath: string, position: Position):
      Promise<string|undefined> {
    const descriptor = await this._getDescriptorAt(localPath, position);
    if (!descriptor) {
      return;
    }
    if (isPropertyDescriptor(descriptor)) {
      if (descriptor.type) {
        return `{${descriptor.type}} ${descriptor.description}`;
      }
    }
    return descriptor.description;
  }

  async getDefinitionFor(localPath: string, position: Position) {
    const descriptor = await this._getDescriptorAt(localPath, position);
    if (!descriptor) {
      return;
    }
    return descriptor.sourceLocation;
  }

  async getTypeaheadCompletionsFor(localPath: string, position: Position):
      Promise<TypeaheadCompletion|undefined> {
    const analysis = await this._analyzer.resolvePermissive();
    const location =
        await this._getLocationResult(localPath, position, analysis);
    if (location.kind === 'tagName' || location.kind === 'text') {
      return {
        kind: 'element-tags',
        elements: analysis.getElements().map(e => {
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
      const element = analysis.getElement(location.element.nodeName);
      if (!element) {
        return;
      }
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
      if (element instanceof PolymerElement) {
        for (const behaviorName of element.behaviors) {
          sortPrefixes.set(behaviorName, 'ddd-');
        }
      }
      return {
        kind: 'attributes',
        attributes:
            element.attributes
                .map(
                    p => ({
                      name: p.name,
                      description: p.description,
                      type: p.type,
                      inheritedFrom: p.inheritedFrom,
                      sortKey:
                          `${sortPrefixes.get(p.inheritedFrom) || 'eee-'}${p.name}`
                    }))
                .concat(element.events.map(
                    e => ({
                      name: `on-${e.name}`,
                      description: e.description,
                      type: e.type || 'CustomEvent',
                      inheritedFrom: e.inheritedFrom,
                      sortKey:
                          `fff-${sortPrefixes.get(e.inheritedFrom) || 'eee-'}on-${e.name}`
                    })))
      };
    }
  }

  private async _getDescriptorAt(localPath: string, position: Position):
      Promise<Element|Property|undefined> {
    const analysis = await this._analyzer.resolvePermissive();
    const location =
        await this._getLocationResult(localPath, position, analysis);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return analysis.getElement(location.element.nodeName);
    } else if (location.kind === 'attribute') {
      return analysis.getElement(location.element.nodeName)
          .properties.find(
              (p) => p && p.name &&
                  p.name.replace(
                      /[A-Z]/g, (c: string) => `-${c.toLowerCase()}`) ===
                      location.attribute);
    }
  }

  private async _getLocationResult(
      localPath: string, position: Position, analysis: Analysis) {
    const documentDesc = await analysis.getDocument(localPath);
    if (!documentDesc) {
      return;
    }
    const document = documentDesc.document;
    if (!(document instanceof ParsedHtmlDocument)) {
      return;
    }
    return getLocationInfoForPosition(document.ast, position);
  }
}


type LocationResult =
    LocatedAttribute | LocatedTag | LocatedEndTag | LocatedInText;
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
    node: parse5.ASTNode, position: Position): LocationResult {
  const location = _getLocationInfoForPosition(node, position);
  if (!location) {
    return {kind: 'text'};
  }
  return location;
}
function _getLocationInfoForPosition(
    node: parse5.ASTNode, position: Position): undefined|LocationResult {
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
    position: Position, location: parse5.LocationInfo): boolean {
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

function isPropertyDescriptor(d: any): d is(ScannedProperty | Property) {
  return 'type' in d;
}
