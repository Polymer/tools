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

import * as minimatch from 'minimatch';
import * as path from 'path';
import * as analyzer from 'polymer-analyzer';
import {Function as AnalyzerFunction} from 'polymer-analyzer/lib/javascript/function';
import Uri from 'vscode-uri';

import {closureParamToTypeScript, closureTypeToTypeScript} from './closure-types';
import * as ts from './ts-ast';

/**
 * Configuration for declaration generation.
 */
export interface Config {
  /**
   * Skip source files whose paths match any of these glob patterns. If
   * undefined, defaults to excluding "index.html" and directories ending in
   * "test" or "demo".
   */
  excludeFiles?: string[];

  /**
   * The same as `excludeFiles`, for backwards compatibility. Will be removed in
   * next major version.
   */
  exclude?: string[];

  /**
   * Do not emit any declarations for features that have any of these
   * identifiers.
   */
  excludeIdentifiers?: string[];

  /**
   * Remove any triple-slash references to these files, specified as paths
   * relative to the analysis root directory.
   */
  removeReferences?: string[];

  /**
   * Additional files to insert as triple-slash reference statements. Given the
   * map `a: b[]`, a will get an additional reference statement for each file
   * path in b. All paths are relative to the analysis root directory.
   */
  addReferences?: {[filepath: string]: string[]};

  /**
   * Whenever a type with a name in this map is encountered, replace it with
   * the given name. Note this only applies to named types found in places like
   * function/method parameters and return types. It does not currently rename
   * e.g. entire generated classes.
   */
  renameTypes?: {[name: string]: string};
}

const defaultExclude = [
  'index.html',
  'test/**',
  'demo/**',
];

/**
 * Analyze all files in the given directory using Polymer Analyzer, and return
 * TypeScript declaration document strings in a map keyed by relative path.
 */
export async function generateDeclarations(
    rootDir: string, config: Config): Promise<Map<string, string>> {
  const a = analyzer.Analyzer.createForDirectory(rootDir);
  const analysis = await a.analyzePackage();
  const outFiles = new Map<string, string>();
  for (const tsDoc of analyzerToAst(analysis, config, rootDir)) {
    outFiles.set(tsDoc.path, tsDoc.serialize())
  }
  return outFiles;
}

/**
 * Make TypeScript declaration documents from the given Polymer Analyzer
 * result.
 */
function analyzerToAst(
    analysis: analyzer.Analysis, config: Config, rootDir: string):
    ts.Document[] {
  const excludeFiles = (config.excludeFiles || config.exclude || defaultExclude)
                           .map((p) => new minimatch.Minimatch(p));
  const addReferences = config.addReferences || {};
  const removeReferencesResolved = new Set(
      (config.removeReferences || []).map((r) => path.resolve(rootDir, r)));
  const renameTypes = new Map(Object.entries(config.renameTypes || {}));

  const analyzerDocs = [
    ...analysis.getFeatures({kind: 'html-document'}),
    ...analysis.getFeatures({kind: 'js-document'}),
  ];

  // We want to produce one declarations file for each file basename. There
  // might be both `foo.html` and `foo.js`, and we want their declarations to be
  // combined into a signal `foo.d.ts`. So we first group Analyzer documents by
  // their declarations filename.
  const declarationDocs = new Map<string, analyzer.Document[]>();
  for (const jsDoc of analyzerDocs) {
    // For every HTML or JS file, Analyzer is going to give us 1) the top-level
    // document, and 2) N inline documents for any nested content (e.g. script
    // tags in HTML). The top-level document will give us all the nested
    // features we need, so skip any inline ones.
    if (jsDoc.isInline) {
      continue;
    }
    const sourcePath = analyzerUrlToRelativePath(jsDoc.url, rootDir);
    if (sourcePath === undefined) {
      console.warn(
          `Skipping source document without local file URL: ${jsDoc.url}`);
      continue;
    }
    if (excludeFiles.some((r) => r.match(sourcePath))) {
      continue;
    }
    const filename = makeDeclarationsFilename(sourcePath);
    let docs = declarationDocs.get(filename);
    if (!docs) {
      docs = [];
      declarationDocs.set(filename, docs);
    }
    docs.push(jsDoc);
  }

  const tsDocs = [];
  for (const [declarationsFilename, analyzerDocs] of declarationDocs) {
    const tsDoc = new ts.Document({
      path: declarationsFilename,
      header: makeHeader(
          analyzerDocs.map((d) => analyzerUrlToRelativePath(d.url, rootDir))
              .filter((url): url is string => url !== undefined)),
    });
    for (const analyzerDoc of analyzerDocs) {
      handleDocument(
          analysis,
          analyzerDoc,
          tsDoc,
          rootDir,
          config.excludeIdentifiers || []);
    }
    for (const ref of tsDoc.referencePaths) {
      const resolvedRef = path.resolve(rootDir, path.dirname(tsDoc.path), ref);
      if (removeReferencesResolved.has(resolvedRef)) {
        tsDoc.referencePaths.delete(ref);
      }
    }
    for (const ref of addReferences[tsDoc.path] || []) {
      tsDoc.referencePaths.add(path.relative(path.dirname(tsDoc.path), ref));
    }
    for (const node of tsDoc.traverse()) {
      if (node.kind === 'name') {
        const renamed = renameTypes.get(node.name);
        if (renamed !== undefined) {
          node.name = renamed;
        }
      }
    }
    tsDoc.simplify();
    // Include even documents with no members. They might be dependencies of
    // other files via the HTML import graph, and it's simpler to have empty
    // files than to try and prune the references (especially across packages).
    tsDocs.push(tsDoc);
  }
  return tsDocs;
}

/**
 * Analyzer always returns fully specified URLs with a protocol and an absolute
 * path (e.g. "file:/foo/bar"). Return just the file path, relative to our
 * project root.
 */
function analyzerUrlToRelativePath(
    analyzerUrl: string, rootDir: string): string|undefined {
  const parsed = Uri.parse(analyzerUrl);
  if (parsed.scheme !== 'file' || parsed.authority || !parsed.fsPath) {
    return undefined;
  }
  return path.relative(rootDir, parsed.fsPath);
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
 * Generate the header comment to show at the top of a declarations document.
 */
function makeHeader(sourceUrls: string[]): string {
  return `DO NOT EDIT

This file was automatically generated by
  https://github.com/Polymer/gen-typescript-declarations

To modify these typings, edit the source file(s):
${sourceUrls.map((url) => '  ' + url).join('\n')}`;
}

interface MaybePrivate {
  privacy?: 'public'|'private'|'protected'
}

/**
 * Extend the given TypeScript declarations document with all of the relevant
 * items in the given Polymer Analyzer document.
 */
function handleDocument(
    analysis: analyzer.Analysis,
    doc: analyzer.Document,
    root: ts.Document,
    rootDir: string,
    excludeIdentifiers: string[]) {
  for (const feature of doc.getFeatures()) {
    if (excludeIdentifiers.some((id) => feature.identifiers.has(id))) {
      continue;
    }
    if ((feature as MaybePrivate).privacy === 'private') {
      continue;
    }
    if (feature.kinds.has('element')) {
      handleElement(feature as analyzer.Element, root);
    } else if (feature.kinds.has('behavior')) {
      handleBehavior(feature as analyzer.PolymerBehavior, root);
    } else if (feature.kinds.has('element-mixin')) {
      handleMixin(feature as analyzer.ElementMixin, root, analysis);
    } else if (feature.kinds.has('class')) {
      handleClass(feature as analyzer.Class, root);
    } else if (feature.kinds.has('function')) {
      handleFunction(feature as AnalyzerFunction, root);
    } else if (feature.kinds.has('namespace')) {
      handleNamespace(feature as analyzer.Namespace, root);
    } else if (feature.kinds.has('import')) {
      // Sometimes an Analyzer document includes an import feature that is
      // inbound (things that depend on me) instead of outbound (things I
      // depend on). For example, if an HTML file has a <script> tag for a JS
      // file, then the JS file's Analyzer document will include that <script>
      // tag as an import feature. We only care about outbound dependencies,
      // hence this check.
      if (feature.sourceRange && feature.sourceRange.file === doc.url) {
        handleImport(feature as analyzer.Import, root, rootDir);
      }
    }
  }
}

/**
 * Add the given Element to the given TypeScript declarations document.
 */
function handleElement(feature: analyzer.Element, root: ts.Document) {
  // Whether this element has a constructor that is assigned and can be called.
  // If it does we'll emit a class, otherwise an interface.
  let constructable;

  let fullName;   // Fully qualified reference, e.g. `Polymer.DomModule`.
  let shortName;  // Just the last part of the name, e.g. `DomModule`.
  let parent;     // Where in the namespace tree does this live.

  if (feature.className) {
    constructable = true;
    let namespacePath;
    [namespacePath, shortName] = splitReference(feature.className);
    fullName = feature.className;
    parent = findOrCreateNamespace(root, namespacePath);

  } else if (feature.tagName) {
    // No `className` means this is an element defined by a call to the Polymer
    // function without a LHS assignment. We'll follow the convention of the
    // Closure Polymer Pass, and emit a global namespace interface called
    // `FooBarElement` (given a `tagName` of `foo-bar`). More context here:
    //
    // https://github.com/google/closure-compiler/wiki/Polymer-Pass#element-type-names-for-1xhybrid-call-syntax
    // https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/PolymerClassDefinition.java#L128
    constructable = false;
    shortName = kebabToCamel(feature.tagName) + 'Element';
    fullName = shortName;
    parent = root;

  } else {
    console.error('Could not find a name.');
    return;
  }

  const behaviors = isPolymerElement(feature) ?
      feature.behaviorAssignments.map((behavior) => behavior.identifier) :
      [];

  if (constructable) {
    parent.members.push(new ts.Class({
      name: shortName,
      description: feature.description || feature.summary,
      extends: (feature.extends) ||
          (isPolymerElement(feature) ? 'Polymer.Element' : 'HTMLElement'),
      mixins: feature.mixins.map((mixin) => mixin.identifier),
      properties: handleProperties(feature.properties.values()),
      methods: [
        ...handleMethods(feature.staticMethods.values(), {isStatic: true}),
        ...handleMethods(feature.methods.values()),
      ]
    }));

    if (behaviors.length > 0) {
      // We need to augment our class declaration with some behaviors. Behaviors
      // are interfaces, so our class can't directly extend them, like we can do
      // with mixin functions. However, the class declaration implicitly creates
      // a corresponding interface with the same name, and we can augment that
      // with the behavior interfaces using declaration merging.
      parent.members.push(new ts.Interface({
        name: shortName,
        extends: behaviors,
      }));
    }

  } else {
    // TODO How do we handle mixins when we are emitting an interface? We don't
    // currently define interfaces for mixins, so we can't just add them to
    // extends.
    const i = new ts.Interface({
      name: shortName,
      description: feature.description || feature.summary,
      properties: handleProperties(feature.properties.values()),
      // Don't worry about about static methods when we're not constructable.
      // Since there's no handle to the constructor, they could never be
      // called.
      methods: handleMethods(feature.methods.values()),
    });

    if (isPolymerElement(feature)) {
      i.extends.push('Polymer.Element');
      i.extends.push(...behaviors);
    }

    parent.members.push(i);
  }

  // The `HTMLElementTagNameMap` global interface maps custom element tag names
  // to their definitions, so that TypeScript knows that e.g.
  // `dom.createElement('my-foo')` returns a `MyFoo`. Augment the map with this
  // custom element.
  if (feature.tagName) {
    const elementMap = findOrCreateInterface(root, 'HTMLElementTagNameMap');
    elementMap.properties.push(new ts.Property({
      name: feature.tagName,
      type: new ts.NameType(fullName),
    }));
  }
}

/**
 * Add the given Polymer Behavior to the given TypeScript declarations
 * document.
 */
function handleBehavior(feature: analyzer.PolymerBehavior, root: ts.Document) {
  if (!feature.className) {
    console.error('Could not find a name for behavior.');
    return;
  }

  const [namespacePath, className] = splitReference(feature.className);
  const ns = findOrCreateNamespace(root, namespacePath);

  // An interface with the properties and methods that this behavior adds to an
  // element. Note that behaviors are not classes, they are just data objects
  // which the Polymer library uses to augment element classes.
  ns.members.push(new ts.Interface({
    name: className,
    description: feature.description || feature.summary,
    extends: feature.behaviorAssignments.map((b) => b.identifier),
    properties: handleProperties(feature.properties.values()),
    methods: handleMethods(feature.methods.values()),
  }));

  // The value that contains the actual definition of the behavior for Polymer.
  // It's not important to know the shape of this object, so the `object` type
  // is good enough. The main use of this is to make statements like
  // `Polymer.mixinBehaviors([Polymer.SomeBehavior], ...)` compile.
  ns.members.push(new ts.ConstValue({
    name: className,
    type: new ts.NameType('object'),
  }));
}

/**
 * Add the given Mixin to the given TypeScript declarations document.
 */
function handleMixin(
    feature: analyzer.ElementMixin,
    root: ts.Document,
    analysis: analyzer.Analysis) {
  const [namespacePath, mixinName] = splitReference(feature.name);
  const parentNamespace = findOrCreateNamespace(root, namespacePath);

  // The mixin function. It takes a constructor, and returns an intersection of
  // 1) the given constructor, 2) the constructor for this mixin, 3) the
  // constructors for any other mixins that this mixin also applies.
  parentNamespace.members.push(new ts.Function({
    name: mixinName,
    description: feature.description,
    templateTypes: ['T extends new (...args: any[]) => {}'],
    params: [
      new ts.ParamType({name: 'base', type: new ts.NameType('T')}),
    ],
    returns: new ts.IntersectionType([
      new ts.NameType('T'),
      new ts.NameType(mixinName + 'Constructor'),
      ...Array.from(transitiveMixins(feature, analysis))
          .map((mixin) => new ts.NameType(mixin + 'Constructor'))
    ]),
  }));

  // The interface for a constructor of this mixin. Returns the instance
  // interface (see below) when instantiated, and may also have methods of its
  // own (static methods from the mixin class).
  parentNamespace.members.push(new ts.Interface({
    name: mixinName + 'Constructor',
    methods: [
      new ts.Method({
        name: 'new',
        params: [
          new ts.ParamType({
            name: 'args',
            type: new ts.ArrayType(ts.anyType),
            rest: true,
          }),
        ],
        returns: new ts.NameType(mixinName),
      }),
      ...handleMethods(feature.staticMethods.values()),
    ],
  }));

  // The interface for instances of this mixin. Has the same name as the
  // function.
  parentNamespace.members.push(
      new ts.Interface({
        name: mixinName,
        properties: handleProperties(feature.properties.values()),
        methods: handleMethods(feature.methods.values()),
      }),
  );
};

/**
 * Mixins can automatically apply other mixins, indicated by the @appliesMixin
 * annotation. However, since those mixins may themselves apply other mixins, to
 * know the full set of them we need to traverse down the tree.
 */
function transitiveMixins(
    parentMixin: analyzer.ElementMixin,
    analysis: analyzer.Analysis,
    result?: Set<string>): Set<string> {
  if (result === undefined) {
    result = new Set();
  }
  for (const childRef of parentMixin.mixins) {
    result.add(childRef.identifier);
    const childMixinSet =
        analysis.getFeatures({id: childRef.identifier, kind: 'element-mixin'});
    if (childMixinSet.size !== 1) {
      console.error(
          `Found ${childMixinSet.size} features for mixin ` +
          `${childRef.identifier}, expected 1.`);
      continue;
    }
    const childMixin = childMixinSet.values().next().value;
    transitiveMixins(childMixin, analysis, result);
  }
  return result;
}

/**
 * Add the given Class to the given TypeScript declarations document.
 */
function handleClass(feature: analyzer.Class, root: ts.Document) {
  if (!feature.className) {
    console.error('Could not find a name for class.');
    return;
  }
  const [namespacePath, name] = splitReference(feature.className);
  const m = new ts.Class({name});
  m.description = feature.description;
  m.properties = handleProperties(feature.properties.values());
  m.methods = [
    ...handleMethods(feature.staticMethods.values(), {isStatic: true}),
    ...handleMethods(feature.methods.values())
  ];
  findOrCreateNamespace(root, namespacePath).members.push(m);
}


/**
 * Add the given Function to the given TypeScript declarations document.
 */
function handleFunction(feature: AnalyzerFunction, root: ts.Document) {
  const [namespacePath, name] = splitReference(feature.name);

  const f = new ts.Function({
    name,
    description: feature.description || feature.summary,
    templateTypes: feature.templateTypes,
    returns: closureTypeToTypeScript(
        feature.return && feature.return.type, feature.templateTypes),
    returnsDescription: feature.return && feature.return.desc
  });

  for (const param of feature.params || []) {
    // TODO Handle parameter default values. Requires support from Analyzer
    // which only handles this for class method parameters currently.
    f.params.push(closureParamToTypeScript(
        param.name, param.type, feature.templateTypes));
  }

  findOrCreateNamespace(root, namespacePath).members.push(f);
}

/**
 * Convert the given Analyzer properties to their TypeScript declaration
 * equivalent.
 */
function handleProperties(analyzerProperties: Iterable<analyzer.Property>):
    ts.Property[] {
  const tsProperties = <ts.Property[]>[];
  for (const property of analyzerProperties) {
    if (property.inheritedFrom || property.privacy === 'private') {
      continue;
    }
    const p = new ts.Property({
      name: property.name,
      // TODO If this is a Polymer property with no default value, then the
      // type should really be `<type>|undefined`.
      type: closureTypeToTypeScript(property.type),
      readOnly: property.readOnly,
    });
    p.description = property.description || '';
    tsProperties.push(p);
  }
  return tsProperties;
}


/**
 * Convert the given Analyzer methods to their TypeScript declaration
 * equivalent.
 */
function handleMethods(
    analyzerMethods: Iterable<analyzer.Method>,
    opts?: {isStatic?: boolean}): ts.Method[] {
  const tsMethods = <ts.Method[]>[];
  for (const method of analyzerMethods) {
    if (method.inheritedFrom || method.privacy === 'private') {
      continue;
    }
    const m = new ts.Method({
      name: method.name,
      returns: closureTypeToTypeScript(method.return && method.return.type),
      returnsDescription: method.return && method.return.desc,
      isStatic: opts && opts.isStatic,
    });
    m.description = method.description || '';

    let requiredAhead = false;
    for (const param of reverseIter(method.params || [])) {
      const tsParam = closureParamToTypeScript(param.name, param.type);
      tsParam.description = param.description || '';

      if (param.defaultValue !== undefined) {
        // Parameters with default values generally behave like optional
        // parameters. However, unlike optional parameters, they may be
        // followed by a required parameter, in which case the default value is
        // set by explicitly passing undefined.
        if (!requiredAhead) {
          tsParam.optional = true;
        } else {
          tsParam.type = new ts.UnionType([tsParam.type, ts.undefinedType]);
        }
      } else if (!tsParam.optional) {
        requiredAhead = true;
      }

      // Analyzer might know this is a rest parameter even if there was no
      // JSDoc type annotation (or if it was wrong).
      tsParam.rest = tsParam.rest || !!param.rest;
      if (tsParam.rest && tsParam.type.kind !== 'array') {
        // Closure rest parameter types are written without the Array syntax,
        // but in TypeScript they must be explicitly arrays.
        tsParam.type = new ts.ArrayType(tsParam.type);
      }

      m.params.unshift(tsParam);
    }

    tsMethods.push(m);
  }
  return tsMethods;
}

/**
 * Iterate over an array backwards.
 */
function* reverseIter<T>(arr: T[]) {
  for (let i = arr.length - 1; i >= 0; i--) {
    yield arr[i];
  }
}

/**
 * Add the given namespace to the given TypeScript declarations document.
 */
function handleNamespace(feature: analyzer.Namespace, tsDoc: ts.Document) {
  const ns = findOrCreateNamespace(tsDoc, feature.name.split('.'));
  if (ns.kind === 'namespace') {
    ns.description = feature.description || feature.summary || '';
  }
}

/**
 * Add an HTML import to a TypeScript declarations file. For a given HTML
 * import, we assume there is a corresponding declarations file that was
 * generated by this same process.
 */
function handleImport(
    feature: analyzer.Import, tsDoc: ts.Document, rootDir: string) {
  let sourcePath = analyzerUrlToRelativePath(feature.url, rootDir);
  if (sourcePath === undefined) {
    console.warn(`Skipping HTML import without local file URL: ${feature.url}`);
    return;
  }
  // When we analyze a package's Git repo, our dependencies are installed to
  // "<repo>/bower_components". However, when this package is itself installed
  // as a dependency, our own dependencies will instead be siblings, one
  // directory up the tree.
  //
  // Analyzer (since 2.5.0) will set an import feature's URL to the resolved
  // dependency path as discovered on disk. An import for "../foo/foo.html"
  // will be resolved to "bower_components/foo/foo.html". Transform the URL
  // back to the style that will work when this package is installed as a
  // dependency.
  sourcePath = sourcePath.replace(/^(bower_components|node_modules)\//, '../');

  // Polymer is a special case where types are output to the "types/"
  // subdirectory instead of as sibling files, in order to avoid cluttering the
  // repo. It would be more pure to store this fact in the Polymer gen-tsd.json
  // config file and discover it when generating types for repos that depend on
  // it, but that's probably more complicated than we need, assuming no other
  // repos deviate from emitting their type declarations as sibling files.
  sourcePath = sourcePath.replace(/^\.\.\/polymer\//, '../polymer/types/');

  tsDoc.referencePaths.add(path.relative(
      path.dirname(tsDoc.path), makeDeclarationsFilename(sourcePath)));
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
    first = new ts.Namespace({name: path[0]});
    root.members.push(first);
  }
  return findOrCreateNamespace(first, path.slice(1));
}

/**
 * Traverse the given node to find the interface AST node with the given path.
 * If it could not be found, add one and return it.
 */
function findOrCreateInterface(
    root: ts.Document|ts.Namespace, reference: string): ts.Interface {
  const [namespacePath, name] = splitReference(reference);
  const namespace_ = findOrCreateNamespace(root, namespacePath);
  for (const member of namespace_.members) {
    if (member.kind === 'interface' && member.name === name) {
      return member;
    }
  }
  const i = new ts.Interface({name});
  namespace_.members.push(i);
  return i;
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

/**
 * Split a reference into an array of namespace path parts, and a name part
 * (e.g. `"Foo.Bar.Baz"` => `[ ["Foo", "Bar"], "Baz" ]`).
 */
function splitReference(reference: string): [string[], string] {
  const parts = reference.split('.');
  const namespacePath = parts.slice(0, -1);
  const name = parts[parts.length - 1];
  return [namespacePath, name];
}
