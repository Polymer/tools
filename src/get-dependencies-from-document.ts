/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {DocumentDescriptor} from 'hydrolysis';
import {posix as posixPath} from 'path';
import {Node, queryAll, predicates, getAttribute} from 'dom5';

export interface DocumentDeps {
  imports?: Array<string>;
  scripts?: Array<string>;
  styles?: Array<string>;
}

function collectScriptsAndStyles(tree: DocumentDescriptor): DocumentDeps {
  let scripts: string[] = [];
  let styles: string[] = [];
  tree.html.script.forEach((script: Node) => {
    // TODO(justinfagnani): stop patching Nodes in Hydrolysis
    let __hydrolysisInlined = (<any>script).__hydrolysisInlined;
    if (__hydrolysisInlined) {
      scripts.push(__hydrolysisInlined);
    }
  });
  tree.html.style.forEach((style: Node) => {
    let href = getAttribute(style, 'href');
    if (href) {
      styles.push(href);
    }
  });
  return {
    scripts,
    styles
  };
}

export function getDependenciesFromDocument(descriptor: DocumentDescriptor, dir: string): DocumentDeps {
  let allHtmlDeps: string[] = [];
  let allScriptDeps = new Set<string>();
  let allStyleDeps = new Set<string>();

  let deps: DocumentDeps = collectScriptsAndStyles(descriptor);
  deps.scripts.forEach((s) => allScriptDeps.add(posixPath.join(dir, s)));
  deps.styles.forEach((s) => allStyleDeps.add(posixPath.join(dir, s)));
  if (descriptor.imports) {
    let queue = descriptor.imports.slice();
    let next;
    while (next = queue.shift()) {
      if (!next.href) {
        continue;
      }
      allHtmlDeps.push(next.href);
      let childDeps = getDependenciesFromDocument(next, posixPath.dirname(next.href));
      allHtmlDeps = allHtmlDeps.concat(childDeps.imports);
      childDeps.scripts.forEach((s) => allScriptDeps.add(s));
      childDeps.styles.forEach((s) => allStyleDeps.add(s));
    }
  }

  return {
    scripts: Array.from(allScriptDeps),
    styles: Array.from(allStyleDeps),
    imports: allHtmlDeps,
  };
}
