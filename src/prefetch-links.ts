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

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Analyzer, Document} from 'polymer-analyzer';
import {relativeUrl} from 'polymer-bundler/lib/url-utils';
import {ProjectConfig} from 'polymer-project-config';

import File = require('vinyl');

import {pathFromUrl, urlFromPath} from './path-transformers';
import {FileMapUrlLoader} from './file-map-url-loader';
import {AsyncTransformStream} from './streams';

/**
 * A stream that modifies HTML files to include prefetch links for all of the
 * file's transitive dependencies.
 */
export class AddPrefetchLinks extends AsyncTransformStream<File, File> {
  files: Map<string, File>;
  private _analyzer: Analyzer;
  private _config: ProjectConfig;

  constructor(config: ProjectConfig) {
    super({objectMode: true});
    this.files = new Map();
    this._config = config;
    this._analyzer =
        new Analyzer({urlLoader: new FileMapUrlLoader(this.files)});
  }

  protected async *
      _transformIter(files: AsyncIterable<File>): AsyncIterable<File> {
    const htmlFileUrls = [];

    // Map all files; pass-through all non-HTML files.
    for await (const file of files) {
      const fileUrl = urlFromPath(this._config.root, file.path);
      this.files.set(fileUrl, file);
      if (path.extname(file.path) !== '.html') {
        yield file;
      } else {
        htmlFileUrls.push(fileUrl);
      }
    }

    // Analyze each HTML file and add prefetch links.
    const analysis = await this._analyzer.analyze(htmlFileUrls);

    for (const documentUrl of htmlFileUrls) {
      const document = analysis.getDocument(documentUrl);
      if (!(document instanceof Document)) {
        const message = document && document.message;
        console.warn(`Unable to get document ${documentUrl}: ${message}`);
        continue;
      }

      const allDependencyUrls = [
        ...document.getFeatures({
          kind: 'import',
          externalPackages: true,
          imported: true,
          noLazyImports: true
        })
      ].filter((d) => !d.lazy).map((d) => d.document.url);

      const directDependencyUrls = [
        ...document.getFeatures({
          kind: 'import',
          externalPackages: true,
          imported: false,
          noLazyImports: true
        })
      ].filter((d) => !d.lazy).map((d) => d.document.url);

      const onlyTransitiveDependencyUrls = allDependencyUrls.filter(
          (d) => directDependencyUrls.indexOf(d) === -1);

      // No need to transform a file if it has no dependencies to prefetch.
      if (onlyTransitiveDependencyUrls.length === 0) {
        yield this.files.get(documentUrl)!;
        continue;
      }

      const prefetchUrls = new Set(onlyTransitiveDependencyUrls);

      const html = createLinks(
          document.parsedDocument.contents,
          document.parsedDocument.baseUrl,
          prefetchUrls,
          document.url ===
              urlFromPath(this._config.root, this._config.entrypoint));
      const filePath = pathFromUrl(this._config.root, documentUrl);
      yield new File({contents: new Buffer(html, 'utf-8'), path: filePath})
    }
  }
}

/**
 * Returns the given HTML updated with import or prefetch links for the given
 * dependencies. The given url and deps are expected to be project-relative
 * URLs (e.g. "index.html" or "src/view.html") unless absolute parameter is
 * `true` and there is no base tag in the document.
 */
export function createLinks(
    html: string,
    baseUrl: string,
    deps: Set<string>,
    absolute: boolean = false): string {
  const ast = parse5.parse(html, {locationInfo: true});
  const baseTag = dom5.query(ast, dom5.predicates.hasTagName('base'));
  const baseTagHref = baseTag ? dom5.getAttribute(baseTag, 'href') : '';

  // parse5 always produces a <head> element.
  const head = dom5.query(ast, dom5.predicates.hasTagName('head'))!;
  for (const dep of deps) {
    let href;
    if (absolute && !baseTagHref) {
      href = absUrl(dep);
    } else {
      href = relativeUrl(absUrl(baseUrl), absUrl(dep));
    }
    const link = dom5.constructors.element('link');
    dom5.setAttribute(link, 'rel', 'prefetch');
    dom5.setAttribute(link, 'href', href);
    dom5.append(head, link);
  }
  dom5.removeFakeRootElements(ast);
  return parse5.serialize(ast);
}

function absUrl(url: string): string {
  return url.startsWith('/') ? url : '/' + url;
}
