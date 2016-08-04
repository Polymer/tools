/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {parse as urlParse} from 'url';
import {DocumentDescriptor} from 'hydrolysis';
import {posix as posixPath} from 'path';
import {Node, queryAll, predicates, getAttribute} from 'dom5';
import * as logging from 'plylog';

const logger = logging.getLogger('cli.build.get-dependencies');

export interface DocumentDeps {
  imports?: Array<string>;
  scripts?: Array<string>;
  styles?: Array<string>;
}

/**
 * Detects if a url is external by checking it's protocol. Also checks if it
 * starts with '//', which can be an alias to the page's current protocol
 * in the browser.
 */
export function isDependencyExternal(url: string) {
  // TODO(fks) 08-01-2016: Add additional check for files on current hostname
  // but external to this application root. Ignore them.
  return urlParse(url).protocol !== null || url.startsWith('//');
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

/**
 * Returns a collection of all local dependencies from a DocumentDescriptor
 * object, ignoring any external dependencies. Because HTML imports can have
 * script and style dependencies of their own, this will recursively call
 * itself down the import tree to collect all dependencies.
 */
export function getDependenciesFromDocument(descriptor: DocumentDescriptor, dir: string): DocumentDeps {
  let allHtmlDeps: string[] = [];
  let allScriptDeps = new Set<string>();
  let allStyleDeps = new Set<string>();
  let deps: DocumentDeps = collectScriptsAndStyles(descriptor);

  // Collect all script dependencies
  deps.scripts.forEach((scriptDep) => {
    if (isDependencyExternal(scriptDep)) {
      logger.debug('external dependency ignored', {dep: scriptDep});
      return;
    }
    allScriptDeps.add(posixPath.join(dir, scriptDep));
  });

  // Collect all style dependencies
  deps.styles.forEach((styleDep) => {
    if (isDependencyExternal(styleDep)) {
      logger.debug('external dependency ignored', {dep: styleDep});
      return;
    }
    allStyleDeps.add(posixPath.join(dir, styleDep));
  });

  // Recursively collects and analyzes all HTML imports and their dependencies
  if (descriptor.imports) {
    let queue = descriptor.imports.slice();
    let next: DocumentDescriptor;
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
