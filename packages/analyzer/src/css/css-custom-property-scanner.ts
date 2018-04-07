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

import * as shady from 'shady-css-parser';

import {ImmutableArray} from '../model/immutable';
import {Feature, ScannedFeature, SourceRange, Warning} from '../model/model';

import {ParsedCssDocument, Visitor} from './css-document';
import {CssScanner} from './css-scanner';

export class CssCustomPropertyScanner implements CssScanner {
  async scan(
      document: ParsedCssDocument, visit: (visitor: Visitor) => Promise<void>) {
    const warnings: Warning[] = [];

    const visitor = new CssCustomPropertyVisitor(document);
    await visit(visitor);

    return {features: visitor.features, warnings};
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'css-custom-property-assignment': CssCustomPropertyAssignment;
  }
}

export class CssCustomPropertyAssignment implements ScannedFeature, Feature {
  readonly sourceRange: SourceRange;
  readonly warnings: ImmutableArray<Warning> = [];
  readonly kinds = new Set(['css-custom-property-assignment']);
  readonly identifiers: Set<string>;
  readonly name: string;

  constructor(name: string, sourceRange: SourceRange) {
    this.identifiers = new Set([name]);
    this.name = name;
    this.sourceRange = sourceRange;
  }

  resolve() {
    return this;
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'css-custom-property-use': CssCustomPropertyUse;
  }
}

export class CssCustomPropertyUse implements ScannedFeature, Feature {
  readonly sourceRange: SourceRange;
  readonly warnings: ImmutableArray<Warning> = [];
  readonly kinds = new Set(['css-custom-property-use']);
  readonly identifiers: Set<string>;
  readonly name: string;

  constructor(name: string, sourceRange: SourceRange) {
    this.identifiers = new Set([name]);
    this.sourceRange = sourceRange;
    this.name = name;
  }

  resolve() {
    return this;
  }
}


class CssCustomPropertyVisitor implements Visitor {
  features: CssCustomPropertyAssignment[] = [];
  constructor(private document: ParsedCssDocument) {
  }

  visit(node: shady.Node): void {
    if (node.type === shady.nodeType.declaration &&
        node.name.startsWith('--')) {
      this.features.push(new CssCustomPropertyAssignment(
          node.name, this.document.sourceRangeForShadyRange(node.nameRange)));
    } else if (node.type === shady.nodeType.expression) {
      this.getCustomPropertiesIn(node.text, node.range);
    } else if (node.type === shady.nodeType.atRule && node.parametersRange) {
      this.getCustomPropertiesIn(node.parameters, node.parametersRange);
    }
  }

  private static readonly customPropRegex = /--[A-Za-z0-9_\-]+/;
  private getCustomPropertiesIn(text: string, range: shady.Range) {
    const matches =
        findAllMatchesInString(CssCustomPropertyVisitor.customPropRegex, text);
    const baseOffset = range.start;
    for (const {offset, matched} of matches) {
      const range = this.document.sourceRangeForShadyRange({
        start: offset + baseOffset,
        end: offset + baseOffset + matched.length
      });
      this.features.push(new CssCustomPropertyUse(matched, range));
    }
  }
}

function* findAllMatchesInString(regex: RegExp, haystack: string) {
  regex = new RegExp(regex, 'g');
  let match;
  while (match = regex.exec(haystack)) {
    yield {offset: match.index, matched: match[0]};
  }
};
