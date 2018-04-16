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

import {Document, Feature, JsAstNode, Privacy, Resolvable, SourceRange, Warning} from '../model/model';

import {Annotation as JsDocAnnotation} from './jsdoc';

export class ScannedFunction implements Resolvable {
  name: string;
  description?: string;
  summary?: string;
  jsdoc?: JsDocAnnotation;
  sourceRange: SourceRange;
  astNode: JsAstNode;
  warnings: Warning[];
  params?: {name: string, type?: string}[];
  return?: {type?: string, desc?: string};
  privacy: Privacy;
  templateTypes?: string[];

  constructor(
      name: string,
      description: string,
      summary: string,
      privacy: Privacy,
      astNode: JsAstNode,
      jsdoc: JsDocAnnotation,
      sourceRange: SourceRange,
      params?: {name: string, type?: string}[],
      returnData?: {type?: string, desc?: string},
      templateTypes?: string[],
  ) {
    this.name = name;
    this.description = description;
    this.summary = summary;
    this.jsdoc = jsdoc;
    this.sourceRange = sourceRange;
    this.astNode = astNode;
    this.warnings = [];
    this.params = params;
    this.return = returnData;
    this.privacy = privacy;
    this.templateTypes = templateTypes;
  }

  resolve(_document: Document) {
    return new Function(this);
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'function': Function;
  }
}
export class Function implements Feature {
  name: string;
  description?: string;
  summary?: string;
  privacy: Privacy;
  kinds: Set<string>;
  identifiers: Set<string>;
  sourceRange: SourceRange;
  astNode: JsAstNode;
  warnings: Warning[];
  params?: {name: string, type?: string}[];
  return?: {type?: string, desc?: string};
  templateTypes?: string[];

  constructor(scannedFunction: ScannedFunction) {
    this.name = scannedFunction.name;
    this.description = scannedFunction.description;
    this.summary = scannedFunction.summary;
    this.kinds = new Set(['function']);
    this.identifiers = new Set([this.name]);
    this.sourceRange = scannedFunction.sourceRange;
    this.astNode = scannedFunction.astNode;
    this.warnings = Array.from(scannedFunction.warnings);
    this.params = scannedFunction.params;
    this.return = scannedFunction.return;
    this.privacy = scannedFunction.privacy;
    this.templateTypes = scannedFunction.templateTypes;
  }

  toString() {
    return `<Function id=${this.name}>`;
  }
}
