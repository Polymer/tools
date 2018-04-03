/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import importMetaSyntax from '@babel/plugin-syntax-import-meta';
import template from '@babel/template';
import {NodePath} from '@babel/traverse';
import {MetaProperty} from '@babel/types';
import {relative} from 'path';

const ast = template.ast;

/**
 * Rewrites `import.meta`[1] into an object with a `url`[2] property.
 *
 * `import.meta.url` must be a URL string with the fully qualified URL of the
 * module. We use the document's base URI and the relative path from rootDir to
 * filePath to build the URL.
 *
 * [1]: https://github.com/tc39/proposal-import-meta
 * [2]: https://html.spec.whatwg.org/#hostgetimportmetaproperties
 *
 * @param relativeUrl The URL path of the file being transformed relative to the
 *   baseURI of the document loading the modules.
 * @param base A base URL to use instead of document.baseURI
 */
export const rewriteImportMeta = (relativeURL: string, base?: string) => {
  return {
    inherits: importMetaSyntax,
    visitor: {
      MetaProperty(path: NodePath<MetaProperty>) {
        const node = path.node;
        if (node.meta && node.meta.name === 'import' &&
            node.property.name === 'meta') {
          const baseURI = base !== undefined ? `'${base}'` : 'document.baseURI';
          path.replaceWith(
              ast`({url: new URL('${relativeURL}', ${baseURI}).toString()})`);
        }
      }
    }
  };
};
