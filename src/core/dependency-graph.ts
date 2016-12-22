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

/**
 * Maintains bidirectional indexes of the dependency graph, for quick querying.
 */
export class DependencyGraph {
  private _dependencies = new Map<string, Set<string>>();
  private _dependants = new Map<string, Set<string>>();

  constructor(from?: DependencyGraph) {
    if (!from) {
      return;
    }
    // This is a copy constructor, but we want to make a deep copy of the
    // other graph, so we need to copy the sets.
    for (const entry of from._dependencies.entries()) {
      this._dependencies.set(entry[0], new Set(entry[1]));
    }
    for (const entry of from._dependants.entries()) {
      this._dependants.set(entry[0], new Set(entry[1]));
    }
  }

  /**
   * Add dependencies of the given path.
   *
   * @param path The path (i.e. url) of a document.
   * @param newDependencies The paths of that document's direct dependencies.
   */
  addDependenciesOf(path: string, newDependencies: Iterable<string>) {
    let dependencies = this._dependencies.get(path);
    if (!dependencies) {
      dependencies = new Set();
      this._dependencies.set(path, dependencies);
    }
    for (const newDependency of newDependencies) {
      dependencies.add(newDependency);
      let dependants = this._dependants.get(newDependency);
      if (!dependants) {
        dependants = new Set();
        this._dependants.set(newDependency, dependants);
      }
      dependants.add(path);
    }
  }

  /**
   * Returns a fork of this graph without the documents at the given paths.
   */
  invalidatePaths(paths: string[]): DependencyGraph {
    const fork = new DependencyGraph(this);
    for (const path of paths) {
      const dependencies = fork._dependencies.get(path);
      if (!dependencies) {
        continue;
      }
      // Tell the dependencies that `path` is no longer one of their dependants.
      for (const dependency of dependencies) {
        const dependants = fork._dependants.get(dependency);
        if (dependants) {
          dependants.delete(path);
        }
      }
      fork._dependencies.delete(path);
    }
    return fork;
  }

  /**
   * Returns the set of transitive dependencies on the given path.
   *
   * So if A depends on B which depends on C, then getAllDependentsOf(C) will
   * be Set([A,B]), and getAllDependantsOf(B) will be Set([A]).
   */
  getAllDependantsOf(path: string): Set<string> {
    const result = new Set();
    this._getAllDependantsOf(path, new Set(), result);
    return result;
  }

  private _getAllDependantsOf(
      path: string, visited: Set<string>, result: Set<string>): void {
    if (visited.has(path)) {
      return;
    }
    visited.add(path);
    const dependants = this._dependants.get(path);
    if (!dependants) {
      return;
    }
    for (const dependant of dependants) {
      result.add(dependant);
      this._getAllDependantsOf(dependant, visited, result);
    }
  }
}
