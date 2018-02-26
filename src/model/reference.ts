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

import {Scope} from 'babel-traverse';
import * as babel from 'babel-types';

import {Annotation} from '../javascript/jsdoc';
import {ParsedDocument} from '../parser/document';

import {Document} from './document';
import {Feature, ScannedFeature} from './feature';
import {Resolvable} from './resolvable';
import {SourceRange} from './source-range';
import {Warning} from './warning';

/**
 * A reference to another feature by identifier.
 */
export class ScannedReference extends ScannedFeature implements Resolvable {
  readonly identifier: string;
  readonly sourceRange: SourceRange|undefined;
  readonly scope: Scope;
  readonly astNode: babel.Node|undefined;

  constructor(
      identifier: string, sourceRange: SourceRange|undefined,
      astNode: babel.Node|undefined, scope: Scope, description?: string,
      jsdoc?: Annotation, warnings?: Warning[]) {
    super(sourceRange, astNode, description, jsdoc, warnings);
    this.astNode = astNode;
    this.scope = scope;
    this.sourceRange = sourceRange;
    this.identifier = identifier;
  }

  resolve(document: Document): Reference {
    const feature = undefined;  // TODO(rictic): the resolve logic
    return new Reference(this, feature, document.parsedDocument);
  }
}

declare module './queryable' {
  interface FeatureKindMap {
    'reference': Reference;
  }
}

const referenceSet: ReadonlySet<'reference'> =
    new Set<'reference'>(['reference']);
const emptySet: ReadonlySet<string> = new Set();

/**
 * A reference to another feature by identifier.
 */
export class Reference implements Feature {
  readonly kinds = referenceSet;
  readonly identifiers = emptySet;
  readonly identifier: string;
  readonly sourceRange: SourceRange|undefined;
  readonly astNode: any;
  readonly feature: Feature|undefined;
  readonly warnings: ReadonlyArray<Warning> = [];

  constructor(
      scannedReference: ScannedReference, _feature: Feature|undefined,
      _document: ParsedDocument) {
    this.identifier = scannedReference.identifier;
    this.sourceRange = scannedReference.sourceRange;
    this.warnings = scannedReference.warnings;
    /*
    TODO(rictic): enable this, after actually performing resolution.
    if (feature === undefined && this.sourceRange) {
      this.warnings = this.warnings.concat([new Warning({
        sourceRange: this.sourceRange,
        code: 'could-not-resolve-reference',
        parsedDocument: document,
        severity: Severity.WARNING,
        message: `Could not resolve this reference. Did you import it?`
      })]);
    }
    */
  }
}
