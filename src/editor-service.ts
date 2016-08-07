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
import {Analyzer} from './analyzer';
import {DocumentDescriptor, ElementDescriptor, PropertyDescriptor} from './ast/ast';
import {SourceLocation} from './elements-format';
import {HtmlDocument} from './html/html-document';

export interface Position {
  /** Line number in file, starting from 0. */
  line: number;
  /** Column number in file, starting from 0. */
  column: number;
}

export type TypeaheadCompletion = ElementCompletion | AttributeCompletion;
export interface ElementCompletion {
  kind: 'element-tags';
  elements: {tagname: string, description: string}[];
}
export interface AttributeCompletion {
  kind: 'attributes';
  attributes: {name: string, description: string}[];
}

export class EditorService {
  private _analyzer: Analyzer;
  constructor(analyzer: Analyzer) {
    this._analyzer = analyzer;
  }

  async fileChanged(localPath: string, contents?: string):
      Promise<DocumentDescriptor> {
    return this._analyzer.analyzeChangedFile(localPath, contents);
  }

  async getDocumentationFor(localPath: string, position: Position):
      Promise<string|undefined> {
    const descriptor = await this._getDescriptorAt(localPath, position);
    if (!descriptor) {
      return;
    }
    return descriptor.desc;
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
    const analysis = await this._analyzer.resolve();
    const location =
        await this._getLocationResult(localPath, position, analysis);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return {
        kind: 'element-tags',
        elements: analysis.getElements().map(
            e => ({tagname: e.is, description: e.desc}))
      };
    } else {
      const element = analysis.getElement(location.element.nodeName);
      if (!element) {
        return;
      }
      return {
        kind: 'attributes',
        attributes: element.properties.map(
            p => ({
              name: p.name.replace(
                  /[A-Z]/g, (c: string) => `-${c.toLowerCase()}`),
              description: p.desc
            }))
      };
    }
  }

  private async _getDescriptorAt(localPath: string, position: Position):
      Promise<ElementDescriptor|PropertyDescriptor|undefined> {
    const analysis = await this._analyzer.resolve();
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
    if (!(document instanceof HtmlDocument)) {
      return;
    }
    return getElementWithStartTagAtPosition(document.ast, position);
  }
}


type LocationResult = LocatedAttribute | LocatedTag;
interface LocatedAttribute {
  kind: 'attribute';
  attribute: string;
  element: parse5.ASTNode;
}
interface LocatedTag {
  kind: 'tagName';
  element: parse5.ASTNode;
}
function getElementWithStartTagAtPosition(
    node: parse5.ASTNode, position: Position): undefined|LocationResult {
  if (node.__location && isElementLocationInfo(node.__location)) {
    const location = node.__location;
    // Early exit examining this node if the position we're interested in
    // is beyond the end tag of the element.
    if (location.endTag.line - 1 < position.line) {
      return;
    }
    if (isPositionInsideLocation(position, location.startTag)) {
      // Ok we're definitely in this start tag, now the question is whether
      // we're in an attribute or the tag itself.
      for (const attrName in location.startTag.attrs) {
        const attributeLocation = location.startTag.attrs[attrName];
        if (isPositionInsideLocation(position, attributeLocation)) {
          return {kind: 'attribute', attribute: attrName, element: node};
        }
      }
      return {kind: 'tagName', element: node};
    }
  }
  if (!node.childNodes) {
    return;
  }
  for (const child of node.childNodes) {
    const result = getElementWithStartTagAtPosition(child, position);
    if (result) {
      return result;
    }
    continue;
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
