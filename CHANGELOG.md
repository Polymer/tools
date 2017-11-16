# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->
<!-- Add new, unreleased changes here. -->

## [2.7.0] - 2017-11-16

* Emit more accurate super classes for Elements when generating analysis JSON.
* Added the concept of automatically safe fixes and less-safe edit actions for Warnings. This is an upstreaming of functionality originally defined in polymer-linter.

## [2.6.0] - 2017-11-06

* Add `defaultValue` and `rest` fields to method parameters.

## [2.5.0] - 2017-11-05

* Use branded subtypes of string to be more careful about how we canonicalize and resolve urls. They're totally normal strings at runtime. TypeScript users that wrote their own UrlLoaders or UrlResolvers may need to make some minor changes to compile green, but since runtime isn't broken this isn't a breaking change. See src/mode/url.ts for more info.
* Handle method rest parameters correctly.

## [2.4.1] - 2017-10-31

* Minor fixes for TypeScript 2.6 compatibility.

## [2.4.0] - 2017-10-26

* Scan for module imports in inline and external JavaScript, analyzing the entire import graph.
* Changed the way HTML script tag containing document features are made available to the JavaScript document, by creating a ScriptTagBackReferenceImport instead of appending the HTML document features directly to JavaScript document.
* [minor] Add an `astNode` property on `Slot`.
* Improve handling of types of properties defined in a behavior or legacy polymer element.

## [2.3.0] - 2017-09-25

* Scan for CSS custom variable uses and assignments.
* Fix value of reflectToAttribute for polymer properties.
* Remove scriptElement from PolymerElement.
* `html-style` features are now scanned for inside templates.

## [2.2.2] - 2017-07-20

* Fixed a bug where we were too aggressive in associating HTML comments with
  nodes, such that any comment that came before a `<script>` tag e.g. could
  become part of the description of the element defined therin.
* Added support for recognizing instance properties in constructors.
  * The properties must be annotated with a jsdoc tag to be recognized.
  * Specific handling of the following tags is supported:
    * `@public`, `@private`, `@protected`, `@type`, and `@const`
    * The description can be combined with a visibility or type annotation. e.g.
      * `/** @type {number} How many bacon wrapped waffles to eat. */`

## [2.2.1] - 2017-07-06

* Removed TypeScript from production dependencies until TypeScript analysis is fully supported.

## [2.2.0] - 2017-06-22

* Comments are now only associated with classes and other objects if they are touching (<2 newlines between them).

## [2.1.0] - 2017-06-02

* Minor bugfix: JSON.stringify(warning) had a bunch of extra unnecessary properties.
* Track static methods on classes, emit them in analysis.json.
* Emit `superclass` for classes in analysis.json.

## [2.0.2] - 2017-05-18

* Track methods on behaviors as such. They were being treated as properties.

## [2.0.1] - 2017-05-15

* Many errors were changed to warnings so they wouldn't stop builds from completing.

## [2.0.0] - 2017-05-15

* Stable release of the Polymer Analyzer.


#### Changes since the previous prerelease version:

* [BREAKING] `attributes`, `properties`, `methods`, and `events` are now Maps from the name to the value rather than arrays. This better models what's actually going on (you can't have two different properties with the same name in javascript) and it makes our inheritance modeling more efficient.
  * Note that the serialized output format `analysis.json` is not changed, it still uses arrays.
* Warning is now a class, not just an interface. It also now keeps track of the
  parsed document that it came from. This fixes a race condition and API wart
  where to print a warning you needed to load the source of the document
  that was seen when the warning was generated.
  * Also, thanks to using the ParsedDocument interface, printing a warning is
    now O(size of underlined text) rather than O(size of document).

## [2.0.0-alpha.42] - 2017-05-09

* [minor breaking change] The paths in `@demo` annotations are no longer resolved.
* Added `MultiUrlLoader` and `PrefixedUrlLoader` to support analysis of more complicated project layouts.

## [2.0.0-alpha.41] - 2017-05-08

* [BREAKING] The `ElementLike` interface in `AnalysisFormat` changed its `demos` property from `string[]` to `Demo[]`, to include more information from `@demo` annotations in Jsdocs.
* [minor breaking change] Simplify rules for infering privacy. Now all features: classes, elements, properties, methods, etc have one set of rules for inferring privacy. Explicit js doc annotations are respected, otherwise `__foo` and `foo_` are private, `_foo` is protected, and `foo` is public.
* Fixed issue where jsdocs syntax in HTML comments was not parsed for polymer elements.

## [2.0.0-alpha.40] - 2017-04-28

* Added support for new JSDoc tags: @customElement, @polymer, @mixinFunction, @appliesMixin

## [2.0.0-alpha.39] - 2017-04-26

* Add a Class feature kind for describing all kinds of classes. This is a superclass of the existing elements and mixins.
* Mix mixins into mixins. A PolymerElementMixin now has all of the members it inherits other mixins it mixes.
* Improved our modeling of inheritance:
  * overriding inherited members now works correctly
  * overriding a private member produces a Warning
* Documented many fields as being readonly/immutable. This isn't complete, in fact all features and scanned features should be treated as immutable once they're created and initialized.
* Treat behaviors more like mixins, and treat using behaviors more like inheriting from mixins. This means that a Behavior object knows about all of the properties, methods, etc that it has inherited from other Behaviors that it builds upon.
* Emit more warnings when recognizing mixins, elements, and classes.

## [2.0.0-alpha.38] - 2017-04-13

* [minor breaking change] Revert of a change from alpha.37. The experimental `_fork` method on Analyzer returns an Analyzer again, not a Promise of an Analyzer.

## [2.0.0-alpha.37] - 2017-04-12

* [BREAKING] Analyzer.analyze() now must be passed an array of urls instead of a single url and it returns an Analysis. Use Analysis.getDocument(url) to get a Document from an Analysis.
* [BREAKING] The `getByKind`, `getById`, `getOnlyAtId`, and `listFeatures` methods on Document and Package have been replaced with a single method: `getFeatures`. It has all of the functionality of the individual methods, just packaged as a single simple query interface.
* [BREAKING] Dropped support for node v4, added support for node v8. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support) for details.
* Added `canLoad` method to `Analyzer`.
* Handle undefined source ranges more gracefully in WarningPrinter.
* [polymer] Negative number literals are allowed in databindings.

## [2.0.0-alpha.36] - 2017-04-07

* [BREAKING] Analyzer.analyze no longer takes the file's current contents as a second argument. This functionality was broken into two pieces, `filesChanged`, and `InMemoryOverlayLoader`.
  * Added a `filesChanged` method to Analyzer letting it know when a file needs to be reloaded.
  * Added an `InMemoryOverlayLoader` UrlLoader, for cases like a text editor where you'd like to use an in memory source of truth for a subset of files.
* The warning printer displays the squiggle underline in the correct place on lines indented by tabs.
* Extract className from the form `var className = Polymer({...})`
* Do a better job of matching comments up with Polymer 2 style element declarations.

## [2.0.0-alpha.35] - 2017-04-05

* [minor breaking change] By default queries for features and warnings now traverse lazy imports. Added a query option to limit results only to those reachable by normal (eager) imports.
* `generateAnalysis()` now includes PolymerBehavior information in `metadata.polymer.behaviors` collection.
* Jsdoc `@demo` annotations are now added to `demos` collection for `Element`, `ElementMixin`, `PolymerElement` and `Behavior`.
* Types and descriptions are now extracted from method @param and @returns jsdoc annotations.
* Fixed caching issue such that Documents would not always have information from the latest versions of their dependencies.

## [2.0.0-alpha.34] - 2017-03-20

* All Documents, ParsedDocuments, and ScannedDocuments now have correct SourceRanges. This also fixes a bug whereby `getByKind('document')` would fail to filter out package-external Documents.
* Fix an issue where package-external features could be included in queries that dot not ask for them. Specifically we were filtering based on the text in files  like `../paper-button/paper-button.html` rather than the path to the file on disk like `bower_components/paper-button/paper-button.html` when determining externality.
* Treat a directory named `build` as external, same as we do ones named `bower_components.*` or `node_modules.*`

## [2.0.0-alpha.33] - 2017-03-14

* Populate `astNode` on `PolymerElementMixin`.

## [2.0.0-alpha.32] - 2017-03-13

* Added options argument for Analyzer's experimental `_fork` method, supporting individual property overrides.
* Parse observers and computed functions in Polymer declarations. Warn on parse errors, or using the wrong syntax (e.g. function calls in `observer`, not a function call in `computed`).
* Correctly scan the `customElements.define(MyClass.is, MyClass)` pattern.

## [2.0.0-alpha.31] - 2017-03-07

* Clean up method descriptions

## [2.0.0-alpha.30] - 2017-03-03

* Fix typo in package.json.

## [2.0.0-alpha.29] - 2017-03-03

* Added a `_fork` method to Analyzer.
* Support for method detection on polymer elements and mixins via the new `methods` property.
* Support for function analysis (namespaced functions only for now, via the `@memberof` jsdoc tag).
* Track privacy on elements, mixins, properties, methods, and functions on namespaces.
  * replaced `private: boolean` with `privacy: 'public' | 'private' | 'protected'`
  * respects `@public` `@private` and `@protected` in jsdoc
  * considers one leading underscore to be protected, and two to be private
  * one trailing underscore is private (closure style)
* Track inheritance source for mixin and element members.
* Exported all public api through the package's `main` file, so that all public api can be accessed directly off of the object returned by `require('polymer-analyzer')` without the need to add imports into `polymer-analyzer/lib/whatever`.
* Track mixins on mixins and emit them in the Analysis. We don't mix properties into mixins yet.

## [2.0.0-alpha.28] - 2017-02-24
* Support for `@memberof` jsdoc tag
* Fix bad mixin descriptions


### Fixed
* PackageUrlResolver encodes URIs returned from `resolve` method.
* Support new properties/observers getters in Polymer 2.0 elements

## [2.0.0-alpha.27] - 2017-02-24

### Added
* Support for `@extends` and `@namespace` jsdoc tags
* Analyze inherited members for class-based elements annotated with `@extends`
* New Namespace and Reference features
* Mixins and namespaces are included in metadata export
* Ability to generate metadata for a package and filter exported metadata
* Analyze Polymer 2.0 elements that override observedAttributes

### Fixed
* Analyzer will not attempt to load or add warnings for imports which can not be resolved by its urlResolver.
* Protocol-less URLs such as `//host/path` are properly handled instead of treated as absolute paths.
* Infer tagnames from the static `is` getter.
* Unified Polymer and Vanilla element scanners

## [2.0.0-alpha.26] - 2017-02-22
* Fix issue with file missing from package.json "files" array.

## [2.0.0-alpha.25] - 2017-02-22

### Added
* Polymer 2.0 mixin scanner
* [polymer] Parse polymer databinding expressions.
  Give accurate warnings on parse errors.

## [2.0.0-alpha.24] - 2017-02-14

### Added
* HTML Documents now include a `baseUrl` property which is properly resolved
  from a `<base href="...">` tag, when present.
* Add `localIds` to `PolymerElement`, tracking elements in its template by their id attributes.

### Fixed

* [Polymer] Better handle unexpected behavior reference syntax.

## [2.0.0-alpha.23] - 2017-02-10

### Added

* [BREAKING] All methods on Document no longer return results from dependencies, but do return results from inline documents. Added a queryOptions param to all query methods to specify getting results from dependencies.
* [BREAKING] All methods on both Document and Package no longer return results from external code. Must specify `externalPackages: true` to get features from code outside the current package.

### Fixed

* Properly cache warning for incorrect imports or when failing parsing an import.
* Notice references to elements within `<template>` tags.

## [2.0.0-alpha.22] - 2017-01-13

### Fixed

* Do not complain about ES6 module syntax, but store enough information that we can warn about referencing modules as scripts.


## [2.0.0-alpha.21] - 2016-12-22

### Added
* Add an analyzePackage() method, for getting a queryable representation of everything in a package.

### Fixed
* Fix a deadlock when there are concurrent analysis runs of cyclic graphs.

## [2.0.0-alpha.20] - 2016-12-19

### Added
* [Polymer] Extract 'listeners' from 1.0-style declarations.
* [Polymer] Extract pseudo elements from HTML comments

### Fixed
* Fix a class of race conditions and cache invalidation errors that can occur when there are concurrent analysis runs and edits to files.


## [2.0.0-alpha.19] - 2016-12-12

### Added
* Add `changeEvent` to `Attribute`.

### Fixed
* Bump JS parser up to parse ES2017 (ES8).
* [Polymer] Property descriptors are allowed to be just a type name, like `value: String`.

## [2.0.0-alpha.18] - 2016-11-21

### Fixed
* [Polymer] A number of fixes around warnings when resolving behaviors
  * Warn, don't throw when a behavior is declared twice.
  * Warn when there's a problem mixing behaviors into other behaviors, the same way that we warn when mixing behaviors into elements.

* Fix some bugs with recursive and mutually recursive imports.

### Added
* Add `slots` to `Element`.

## [2.0.0-alpha.17] - 2016-10-28 - [minor]

### Added
* Improve the way we expose the `ElementReference` type.

## [2.0.0-alpha.16] - 2016-10-20

### Added

* Add a new default scanner for custom element references in html.
  * Also adds a non-default scanner for all element references in html.
  * Known bug: does not find element references inside of `<template>` elements.

## [2.0.0-alpha.15] - 2016-10-15

### Changed

* (polymer) - computed properties are implicitly readOnly.

* (editor service) - Greatly improve `getLocationForPosition` for determining the meaning of text at an HTML source location. Presently used for doing autocompletions.
  * Handles the contents of `<template>` elements.
  * Distinguishes attribute names from values.
  * Understands when text is inside a comment, inline style, and inline script.
  * Better handle many, many edge cases.
