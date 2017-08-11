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

/**

A set of tools for working with iterables. Will break out into its own module
once it's been proven here.

Design Principles:

  - Only work with iterables.
  - Each function does one and only one thing.
  - If something can be done as a one liner in standard javascript then it does
    not need to be a function here.
    - e.g. `const val = first(iterable)` can just be written
           `const [val] = iterable;` so we don't need a `first` function.
  - Assume correct code. For example, predicates must return `true` and `false`
    rather than truthy and falsy values.

*/

export class FluentIterable<V> implements Iterable<V> {
  private readonly wrappedIterable: Iterable<V>;
  constructor(wrappedIterable: Iterable<V>) {
    this.wrappedIterable = wrappedIterable;
  }

  [Symbol.iterator]() {
    return this.wrappedIterable[Symbol.iterator]();
  }

  /**
   * Create one iterable from many by yielding all of the elements of each in
   * turn.
   */
  static chain<V>(iterables: Iterable<Iterable<V>>): FluentIterable<V> {
    return new FluentIterable({
      * [Symbol.iterator]() {
          for (const iterable of iterables) {
            yield* iterable;
          }
        }
    });
  }

  /**
   * Apply the given mapping function to each element of the iterable.
   */
  map<U>(mapper: (v: V, idx: number) => U): FluentIterable<U> {
    const self = this;
    return new FluentIterable({
      * [Symbol.iterator]() {
          let i = 0;
          for (const val of self) {
            yield mapper(val, i);
            i++;
          }
        }
    });
  }

  /**
   * Returns an iterable with only those elements that the given predicate
   * returns the value `true` for.
   */
  filter<U extends V>(predicate: (v: V) => v is U): FluentIterable<U>;
  filter(predicate: (v: V) => boolean): FluentIterable<V>;

  filter(predicate: (v: V) => boolean): FluentIterable<V> {
    const self = this;
    return new FluentIterable({
      * [Symbol.iterator]() {
          for (const val of self) {
            if (predicate(val) === true) {
              yield val;
            }
          }
        }
    });
  }

  /**
   * Returns an iterable with only the first `count` elements.
   *
   * If there are fewer than `count` elements in the given iterable, this
   * function is effectively a noop.
   */
  take(count: number): FluentIterable<V> {
    const self = this;
    return new FluentIterable({
      * [Symbol.iterator]() {
          let remaining = count;
          for (const val of self) {
            if (remaining <= 0) {
              return;
            }
            yield val;
            remaining--;
          }
        }
    });
  }

  /**
   * Yield elements from the given iterable while the predicate returns `true`
   * for each value.
   */
  takeWhile<U extends V>(predicate: (v: V) => v is U): FluentIterable<U>;
  takeWhile(predicate: (v: V) => boolean): FluentIterable<V>;

  takeWhile(predicate: (v: V) => boolean): FluentIterable<V> {
    const self = this;
    return new FluentIterable({
      * [Symbol.iterator]() {
          for (const val of self) {
            if (predicate(val) === true) {
              yield val;
            } else {
              return;
            }
          }
        }
    });
  }

  /**
   * Yield elements from `this`, then from each given iterable in turn.
   */
  concat(...iterables: Array<Iterable<V>>): FluentIterable<V> {
    return FluentIterable.chain([this, ...iterables]);
  }

  /**
   * Returns the first value in the iterable that matches the predicate.
   */
  find<U extends V>(predicate: (v: V) => v is U): U|undefined;
  find(predicate: (v: V) => boolean): V|undefined;
  find(predicate: (v: V) => boolean): V|undefined {
    for (const val of this) {
      if (predicate(val) === true) {
        return val;
      }
    }
    return undefined;
  }

  /** Return the final value in the iterable, or undefined if it's empty. */
  last(): V|undefined {
    if (Array.isArray(this.wrappedIterable)) {
      return this.wrappedIterable[this.wrappedIterable.length - 1];
    }
    let result = undefined;
    for (const value of this) {
      result = value;
    }
    return result;
  }
}
