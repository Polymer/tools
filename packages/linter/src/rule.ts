/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {Document, ParsedDocument, Warning} from 'polymer-analyzer';

/**
 * A lint rule. Can take a package and find Warnings.
 */
export abstract class Rule {
  /**
   * A unique identifier for this lint rule, like "move-style-into-template".
   */
  abstract readonly code: string;

  /**
   * A description of this lint rule. Like "Warns for style
   * children of dom-modules outside of template tags."
   */
  abstract readonly description: string;

  protected readonly cache =
      new WeakMap<Document, Promise<ReadonlyArray<Warning>>>();

  /**
   * Finds all warnings in the given document.
   *
   * If this rule has checked this document before, just looks up the result
   * in our cache. Because Documents are immutable and are guaranteed to be
   * different if any of their contents are different, this caching is safe.
   */
  cachedCheck(document: Document): Promise<ReadonlyArray<Warning>> {
    const cacheResult = this.cache.get(document);
    if (cacheResult) {
      return cacheResult;
    }
    const result = this.check(document);
    this.cache.set(document, result);
    return result;
  }

  /**
   * Finds all warnings in the given document.
   */
  protected abstract check(document: Document): Promise<Warning[]>;
}

/**
 * A named collection of lint rules. Useful for building collections of rules,
 * like rules that note problems that may arise upgrading from Polymer 1.0 to
 * 2.0.
 */
export class RuleCollection {
  /**
   * A unique string identifying this collection. Uses the same namespace as
   * Rules.
   */
  readonly code: string;

  /**
   * Describes the rule collection.
   *
   * A description should answer questions like: Who should use it? When? What
   * should they expect?
   */
  readonly description: string;

  /**
   * A list of codes that identify the rules in this collection.
   *
   * The codes can identify rules or rule collections.
   */
  readonly rules: ReadonlyArray<string>;

  constructor(code: string, description: string, rules: string[]) {
    this.code = code;
    this.description = description;
    this.rules = rules;
  }
}

// Need to have ParsedDocument in exported types for some reason.
const t: null|ParsedDocument = null;
t;
