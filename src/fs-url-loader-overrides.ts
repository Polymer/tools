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

import { FSUrlLoader } from "polymer-analyzer/lib";

/**
 * Resolves requests via the file system, with an additional map of url->file
 * values to check first before falling back to the file system.
 */
export class FSUrlOverrideLoader extends FSUrlLoader {
  overrideMap: Map<string, string>;

  constructor(overrideMap: Map<string, string>, root?: string) {
    super(root);
    this.overrideMap = overrideMap;
  }

  canLoad(url: string): boolean {
    if (this.overrideMap.has(url)) {
      return true;
    } else {
      return super.canLoad(url);
    }
  }

  load(url: string): Promise<string> {
    if (this.overrideMap.has(url)) {
      return Promise.resolve(this.overrideMap.get(url));
    } else {
      return super.load(url);
    }
  }

}
