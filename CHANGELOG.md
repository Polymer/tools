# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).


<!--
   PRs should document their user-visible changes (if any) in the
   Unreleased section, uncommenting the header as necessary.
-->

<!--## Unreleased-->

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
