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

import {isCancel} from 'cancel-token';
import {assert} from 'chai';
import * as path from 'path';
import URI from 'vscode-uri';

import {Analyzer} from '../core/analyzer';
import {neverCancels} from '../core/cancel-token';
import {FileRelativeUrl, PackageRelativeUrl, ParsedDocument, ResolvedUrl, ScannedFeature, UrlResolver} from '../index';
import {makeParseLoader, SourceRange, Warning} from '../model/model';
import {scan} from '../scanning/scan';
import {Scanner} from '../scanning/scanner';
import {FsUrlLoader} from '../url-loader/fs-url-loader';
import {InMemoryOverlayUrlLoader} from '../url-loader/overlay-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';
import {UrlLoader} from '../url-loader/url-loader';
import {underlineCode} from '../warning/code-printer';

export class UnexpectedResolutionError extends Error {
  resolvedValue: any;
  constructor(message: string, resolvedValue: any) {
    super(message);
    this.resolvedValue = resolvedValue;
  }
}

export async function invertPromise(promise: Promise<any>): Promise<any> {
  let value: any;
  try {
    value = await promise;
  } catch (e) {
    return e;
  }
  throw new UnexpectedResolutionError('Inverted Promise resolved', value);
}

export type Reference = Warning|SourceRange|undefined;

/**
 * Used for asserting that warnings or source ranges correspond to the right
 * parts of the source code.
 *
 * Non-test code probably wants WarningPrinter instead.
 */
export class CodeUnderliner {
  private _parsedDocumentGetter: (url: string) => Promise<ParsedDocument>;
  constructor(urlLoader: UrlLoader, urlResolver?: UrlResolver) {
    const analyzer = new Analyzer({urlLoader, urlResolver});
    this._parsedDocumentGetter = makeParseLoader(analyzer);
  }

  static withMapping(url: ResolvedUrl, contents: string) {
    const urlLoader = new InMemoryOverlayUrlLoader();
    urlLoader.urlContentsMap.set(url, contents);
    return new CodeUnderliner(urlLoader, new class extends UrlResolver {
      resolve(
          firstUrl: ResolvedUrl|PackageRelativeUrl,
          secondUrl?: FileRelativeUrl) {
        return this.brandAsResolved(secondUrl || firstUrl);
      }

      relative(to: ResolvedUrl): PackageRelativeUrl;
      relative(
          from: ResolvedUrl, to: ResolvedUrl, kind?: string): FileRelativeUrl;
      relative(): FileRelativeUrl|PackageRelativeUrl {
        throw new Error('does not do relative');
      }
    }());
  }

  /**
   * Converts one or more warnings/source ranges into underlined text.
   *                                                  ~~~~~~~~~~ ~~~~
   *
   * This has a loose set of types that it will accept in order to make
   * writing tests simple and legible.
   */
  async underline(reference: Reference): Promise<string>;
  async underline(references: ReadonlyArray<Reference>):
      Promise<ReadonlyArray<string>>;
  async underline(reference: Reference|ReadonlyArray<Reference>):
      Promise<string|ReadonlyArray<string>> {
    if (isReadonlyArray(reference)) {
      return Promise.all(reference.map((ref) => this.underline(ref)));
    }

    if (reference === undefined) {
      return 'No source range given.';
    }
    if (isWarning(reference)) {
      return '\n' + reference.toString({verbosity: 'code-only', color: false});
    }
    // We have a reference without its parsed document. Go get it.
    const parsedDocument = await this._parsedDocumentGetter(reference.file);
    return '\n' + underlineCode(reference, parsedDocument);
  }
}

function isReadonlyArray(maybeArr: any): maybeArr is ReadonlyArray<any> {
  return Array.isArray(maybeArr);
}

function isWarning(wOrS: Warning|SourceRange): wOrS is Warning {
  return 'code' in wOrS;
}

/**
 * Run the given scanner on the given package relative url.
 *
 * The url must be loadable with the given analyzer.
 */
export async function runScanner(
    analyzer: Analyzer,
    scanner: Scanner<ParsedDocument, any, any>,
    url: string): Promise<{features: ScannedFeature[], warnings: Warning[]}> {
  const context = await analyzer['_analysisComplete'];
  const resolvedUrl = analyzer.resolveUrl(url)!;
  const parsedDocument = await context['_parse'](resolvedUrl, neverCancels);
  return scan(parsedDocument, [scanner]);
}

/**
 * Run the given scanner on some file contents as a string.
 *
 * Note that the url's file extension is relevant, because it will affect how
 * the file is parsed.
 */
export async function runScannerOnContents(
    scanner: Scanner<ParsedDocument, any, any>, url: string, contents: string) {
  const overlayLoader = new InMemoryOverlayUrlLoader();
  const analyzer = new Analyzer({urlLoader: overlayLoader});
  overlayLoader.urlContentsMap.set(analyzer.resolveUrl(url)!, contents);
  const {features, warnings} = await runScanner(analyzer, scanner, url);
  return {features, warnings, analyzer, urlLoader: overlayLoader};
}

export const noOpTag =
    (strings: TemplateStringsArray, ...values: any[]): string => values.reduce(
        (r: string, v: any, i) => r + String(v) + strings[i + 1], strings[0]);

export function fileRelativeUrl(
    strings: TemplateStringsArray, ...values: any[]): FileRelativeUrl {
  return noOpTag(strings, ...values) as FileRelativeUrl;
}

export function packageRelativeUrl(
    strings: TemplateStringsArray, ...values: any[]): PackageRelativeUrl {
  return noOpTag(strings, ...values) as PackageRelativeUrl;
}

export function resolvedUrl(
    strings: TemplateStringsArray, ...values: any[]): ResolvedUrl {
  return noOpTag(strings, ...values) as ResolvedUrl;
}

/**
 * On posix systems file urls look like:
 *      file:///path/to/foo
 * On windows they look like:
 *      file:///c%3A/path/to/foo
 *
 * This will produce an OS-correct file url. Pretty much only useful for testing
 * url resolvers.
 */
export function rootedFileUrl(
    strings: TemplateStringsArray, ...values: any[]): ResolvedUrl {
  const root = URI.file(path.resolve('/')).toString();
  const text = noOpTag(strings, ...values) as FileRelativeUrl;
  return (root + text) as ResolvedUrl;
}

export const fixtureDir = path.join(__dirname, '../../src/test/static');
export async function assertIsCancelled(promise: Promise<any>): Promise<void> {
  const rejection = await invertPromise(promise);
  assert.isTrue(isCancel(rejection), `Expected ${rejection} to be a Cancel.`);
}

/**
 * Returns an analyzer with configuration inferred for the given directory.
 *
 * Currently this just creates a simple analyzer with a Fs loader rooted
 * at the given directory, but in the future it may take configuration from
 * files including polymer.json or similar.
 */
export async function createForDirectory(dirname: string) {
  const urlLoader = new FsUrlLoader(dirname);
  const urlResolver = new PackageUrlResolver({packageDir: dirname});
  const analyzer = new Analyzer({urlLoader, urlResolver});
  const underliner = new CodeUnderliner(analyzer);
  return {urlLoader, urlResolver, analyzer, underliner};
}
