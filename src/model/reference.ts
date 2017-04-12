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

import {Annotation} from '../javascript/jsdoc';

import {Document} from './document';
import {Feature, ScannedFeature} from './feature';
import {Resolvable} from './resolvable';
import {SourceRange} from './source-range';
import {Warning} from './warning';

export interface ScannedReferenceInit extends Partial<Reference> {
  identifier: string;
}

/**
 * A reference to another feature by identifier.
 */
export class ScannedReference extends ScannedFeature implements Resolvable {
  identifier: string;

  constructor(
      identifier: string, sourceRange?: SourceRange, astNode?: any,
      description?: string, jsdoc?: Annotation, warnings?: Warning[]) {
    super(sourceRange, astNode, description, jsdoc, warnings);
    this.identifier = identifier;
  }

  resolve(_document: Document): Reference {
    // TODO(justinfagnani): include an actual reference?
    // Would need a way to get a Kind to pass to Document.getById().
    // Should Kind in getById by optional?
    return new Reference(
        this.identifier, this.sourceRange, this.astNode, this.warnings);
  }
}

export interface ReferenceInit extends Partial<Reference> {
  identifier: string;
}

declare module './queryable' {
  interface FeatureKindMap {
    'reference': Reference;
  }
}
/**
 * A reference to another feature by identifier.
 */
export class Reference extends Feature {
  identifier: string;

  constructor(
      identifier: string, sourceRange?: SourceRange, astNode?: any,
      warnings?: Warning[]) {
    super(sourceRange, astNode, warnings);
    this.kinds.add('reference');
    this.identifier = identifier;
  }
}
