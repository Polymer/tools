# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased
<!-- Add new, unreleased changes here. -->

## [3.4.0] - 2017-06-21
* Modified the `bundle` property in project build options to support the subset of `polymer-bundler` options which can be serialized in a JSON file.

## [3.3.0] - 2017-06-09
* Removed `insertPrefetchLinks` from build presets. See https://github.com/Polymer/polymer-build/issues/239 for details.

## [3.2.1] - 2017-05-19
* Turned on insertPrefetchLinks for the bundled presets after prefetch link bugs were fixed.

## [3.2.0] - 2017-05-15
* Add ProjectConfig toJSON method.

## [3.1.0] - 2017-05-15
* Add browserCapabilities and basePath options.

## [3.0.0] - 2017-05-09
* Add build preset support.
* Remove Node v4 support: Node v4 is no longer in Active LTS, so as per the [Polymer Tools Node.js Support Policy](https://www.polymer-project.org/2.0/docs/tools/node-support) we will not support Node v4 going forward. Please update to Node v6 or later to continue using the latest verisons of Polymer tooling.


## [2.1.1] - 2017-04-14
* Add more documentation, and expose it through the JSON Schema.

## [2.1.0] - 2017-04-11
* `builds`: Add support for `addPushManifest` build option. See [polymer-build README](https://github.com/Polymer/polymer-build#projectaddpushmanifest) for more information.


## [2.0.1] - 2017-02-28
* Update version of plylog.

## [2.0.0] - 2017-02-10

* [BREAKING] polymer.json is validated upon being read and an error will be thrown if any fields are of the wrong type. All toplevel fields are optional, and no error is thrown on encountering extra fields.
* Added "lint" config option for configuring polymer-lint.

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
