# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased - Breaking Changes

## [1.2.0] - 2017-01-27

* Added `isSources()` method to ProjectConfig: validates that a given file path matches the project's "sources" globs. Useful for determining if a file should be treated as a source file or as a dependency.
* New Config Option: `builds` defines project build configurations.
* `validate()` now checks the `builds` property for missing and duplicate names.

## [1.1.0] - 2016-12-09

* Added `validate()` method to ProjectConfig: validates that polymer.json contains valid paths.

## [1.0.2] - 2016-09-23

* Add `package.json` metadata

## [1.0.1] - 2016-09-23

* Add `.npmignore`

## [1.0.0] - 2016-09-23

* Initial release!
