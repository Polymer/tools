# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).


## Unreleased

### Fixed
* [Polymer] A number of fixes around warnings when resolving behaviors
  * Warn, don't throw when a behavior is declared twice.
  * Warn when there's a problem mixing behaviors into other behaviors, the same way that we warn when mixing behaviors into elements.

* Fix some bugs with recursive and mutually recursive imports.

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
