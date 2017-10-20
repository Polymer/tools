/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as path from 'path';
import * as analyzer from 'polymer-analyzer';
import {Function as AnalyzerFunction} from 'polymer-analyzer/lib/javascript/function';

import {closureParamToTypeScript, closureTypeToTypeScript} from './closure-types';
import * as ts from './ts-ast';
import {serializeTsDeclarations} from './ts-serialize';

/**
 * Analyze all files in the given directory using Polymer Analyzer, and return
 * TypeScript declaration document strings in a map keyed by relative path.
 */
export async function generateDeclarations(rootDir: string):
    Promise<Map<string, string>> {
  const a = new analyzer.Analyzer({
    urlLoader: new analyzer.FSUrlLoader(rootDir),
    urlResolver: new analyzer.PackageUrlResolver(),
  });
  const analysis = await a.analyzePackage();
  const outFiles = new Map<string, string>();
  for (const tsDoc of analyzerToAst(analysis)) {
    outFiles.set(tsDoc.path, serializeTsDeclarations(tsDoc));
  }
  return outFiles;
}

/**
 * Make TypeScript declaration documents from the given Polymer Analyzer
 * result.
 */
function analyzerToAst(analysis: analyzer.Analysis): ts.Document[] {
  // Analyzer can produce multiple JS documents with the same URL (e.g. an HTML
  // file with multiple inline scripts). We also might have multiple files with
  // the same basename (e.g. `foo.html` with an inline script, and `foo.js`).
  // We want to produce one declarations file for each basename, so we first
  // group Analyzer documents by their declarations filename.
  const declarationDocs = new Map<string, analyzer.Document[]>();
  for (const jsDoc of analysis.getFeatures({kind: 'js-document'})) {
    // TODO This is a very crude exclusion rule.
    if (jsDoc.url.match(/(test|demo)\//)) {
      continue;
    }
    const filename = makeDeclarationsFilename(jsDoc.url);
    let docs = declarationDocs.get(filename);
    if (!docs) {
      docs = [];
      declarationDocs.set(filename, docs);
    }
    docs.push(jsDoc);
  }

  const tsDocs = new Array<ts.Document>();
  for (const [declarationsFilename, analyzerDocs] of declarationDocs) {
    const tsDoc: ts.Document = {
      kind: 'document',
      path: declarationsFilename,
      members: [],
    };
    for (const analyzerDoc of analyzerDocs) {
      handleDocument(analyzerDoc, tsDoc);
    }
    if (tsDoc.members.length) {
      tsDocs.push(tsDoc);
    }
  }
  return tsDocs;
}

/**
 * Create a TypeScript declarations filename for the given source document URL.
 * Simply replaces the file extension with `d.ts`.
 */
function makeDeclarationsFilename(sourceUrl: string): string {
  const parsed = path.parse(sourceUrl);
  return path.join(parsed.dir, parsed.name) + '.d.ts';
}

/**
 * Extend the given TypeScript declarations document with all of the relevant
 * items in the given Polymer Analyzer document.
 */
function handleDocument(doc: analyzer.Document, root: ts.Document) {
  // TODO Should we traverse and serialize all features in the same order they
  // were originally declared, instead of grouping by type as we do here?
  for (const element of doc.getFeatures({kind: 'element'})) {
    handleElementOrBehavior(element, root);
  }
  for (const behavior of doc.getFeatures({kind: 'behavior'})) {
    handleElementOrBehavior(behavior, root);
  }
  for (const fn of doc.getFeatures({kind: 'function'})) {
    handleFunction(fn, root);
  }
}

/**
 * Add the given Element or Behavior to the given TypeScript declarations
 * document.
 */
function handleElementOrBehavior(
    feature: analyzer.Element|analyzer.PolymerBehavior, root: ts.Document) {
  let className, parent;
  if (feature.className) {
    const parts = feature.className.split('.');
    className = parts[parts.length - 1];
    parent = findOrCreateNamespace(root, parts.slice(0, -1));
  } else if (feature.tagName) {
    className = kebabToCamel(feature.tagName);
    parent = root;
  } else {
    console.error('Could not find a name.');
    return;
  }

  const extends_ = new Array<string>();
  if (isPolymerElement(feature)) {
    // TODO Only do this when it's a legacy Polymer element.
    extends_.push('Polymer.Element');
    for (const behavior of feature.behaviorAssignments) {
      extends_.push(behavior.name);
    }
  } else if (isElement(feature)) {
    extends_.push('HTMLElement');
  }

  const properties = new Array<ts.Property>();
  for (const property of feature.properties.values()) {
    if (property.inheritedFrom) {
      continue;
    }
    properties.push({
      kind: 'property',
      name: property.name || '',
      description: property.description || '',
      type: property.type ? closureTypeToTypeScript(property.type) : 'any',
    });
  }

  const methods = new Array<ts.Method>();
  for (const method of feature.methods.values()) {
    if (method.inheritedFrom) {
      continue;
    }
    const params: ts.Param[] = [];
    for (const param of method.params || []) {
      const {optional, type} = closureParamToTypeScript(param.type || '');
      params.push({
        kind: 'param',
        name: param.name,
        type,
        optional,
      });
    }
    methods.push({
      kind: 'method',
      name: method.name || '',
      description: method.description || '',
      params: params,
      returns: method.return && method.return.type ?
          closureTypeToTypeScript(method.return.type) :
          'any',
    });
  }

  parent.members.push({
    kind: 'interface',
    name: className,
    description: feature.description,
    extends: extends_,
    properties: properties,
    methods: methods,
  });
}

/**
 * Add the given Function to the given TypeScript declarations document.
 */
function handleFunction(feature: AnalyzerFunction, root: ts.Document) {
  const parts = feature.name.split('.');
  const name = parts[parts.length - 1];
  const parent = findOrCreateNamespace(root, parts.slice(0, -1));

  const params: ts.Param[] = [];
  for (const param of feature.params || []) {
    const {optional, type} = closureParamToTypeScript(param.type || '');
    params.push({
      kind: 'param',
      name: param.name,
      type,
      optional,
    });
  }

  parent.members.push({
    kind: 'function',
    name: name,
    description: feature.description || '',
    params: params,
    returns: feature.return && feature.return.type ?
        closureTypeToTypeScript(feature.return.type) :
        'any',
  });
}

/**
 * Traverse the given node to find the namespace AST node with the given path.
 * If it could not be found, add one and return it.
 */
function findOrCreateNamespace(
    root: ts.Document|ts.Namespace, path: string[]): ts.Document|ts.Namespace {
  if (!path.length) {
    return root;
  }
  let first: ts.Namespace|undefined;
  for (const member of root.members) {
    if (member.kind === 'namespace' && member.name === path[0]) {
      first = member;
      break;
    }
  }
  if (!first) {
    first = {
      kind: 'namespace',
      name: path[0],
      members: [],
    };
    root.members.push(first);
  }
  return findOrCreateNamespace(first, path.slice(1));
}

/**
 * Type guard that checks if a Polymer Analyzer feature is an Element.
 */
function isElement(feature: analyzer.Feature): feature is analyzer.Element {
  return feature.kinds.has('element');
}

/**
 * Type guard that checks if a Polymer Analyzer feature is a PolymerElement.
 */
function isPolymerElement(feature: analyzer.Feature):
    feature is analyzer.PolymerElement {
  return feature.kinds.has('polymer-element');
}

/**
 * Convert kebab-case to CamelCase.
 */
function kebabToCamel(s: string): string {
  return s.replace(/(^|-)(.)/g, (_match, _p0, p1) => p1.toUpperCase());
}
