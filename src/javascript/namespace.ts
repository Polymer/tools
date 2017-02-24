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

import * as estree from 'estree';

import * as jsdoc from '../javascript/jsdoc';
import {Document, Feature, Resolvable, SourceRange} from '../model/model';
import {Severity, Warning} from '../warning/warning';

/**
 * The metadata for a JavaScript namespace.
 */
export class ScannedNamespace implements Resolvable {
  name: string;
  description?: string;
  jsdoc?: jsdoc.Annotation;
  sourceRange: SourceRange;
  astNode: estree.Node;
  warnings: Warning[];

  constructor(
      name: string, astNode: estree.Node, jsdoc: jsdoc.Annotation,
      sourceRange: SourceRange) {
    this.name = name;
    this.description = jsdoc.description;
    this.jsdoc = jsdoc;
    this.sourceRange = sourceRange;
    this.astNode = astNode;
    this.warnings = [];
  }

  resolve(document: Document) {
    const foundNamespaces = document.getById(
        'namespace', this.name, {imported: true, externalPackages: true});
    if (foundNamespaces.size > 0) {
      document.warnings.push({
        message: `Found more than one namespace named ${this.name}.`,
        severity: Severity.WARNING,
        code: 'multiple-javascript-namespaces',
        sourceRange: this.sourceRange
      });
      return;
    }
    return new Namespace(this);
  }
}

export class Namespace implements Feature {
  name: string;
  kinds: Set<string>;
  identifiers: Set<string>;
  sourceRange: SourceRange;
  astNode: any;
  warnings: Warning[];

  constructor(scannedNamespace: ScannedNamespace) {
    this.name = scannedNamespace.name;
    this.kinds = new Set(['namespace']);
    this.identifiers = new Set([this.name]);
    this.sourceRange = scannedNamespace.sourceRange;
    this.astNode = scannedNamespace.astNode;
    this.warnings = Array.from(scannedNamespace.warnings);
  }

  toString() {
    return `<Namespace id=${this.name}>`;
  }
}
