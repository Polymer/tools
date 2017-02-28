# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!--## Unreleased-->

<!--
  New PRs should document their changes here, uncommenting the Unreleased
  heading as necessary.
-->

## [0.5.0] - 2017-02-28

* Add the ability to provide a new default transport.
* [Breaking] Log level is now a property on `defaultConfig`, not on the module export directly.

## [0.3.0] - 2016-05-13

### Changed
* [Breaking] log level is no longer a property on config, but on the module export directly. https://github.com/Polymer/plylog/commit/434718a80bc325ed0c8ef4959f8c6c8bee9cfff1

## [0.2.0] - 2016-05-13

### Changed
* [Breaking] Move log level methods into a getter and setter.

## [0.1.0]- 2016-05-12

### Added
* Pretty print logged objects.

## [0.0.2] - 2016-05-12

### Added
* Initial release!
