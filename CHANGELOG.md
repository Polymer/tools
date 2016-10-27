# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

<!-- New PRs should document their changes here. -->

### Added
* Support relative `root` paths.

### Deprecated
* Two AddServiceWorkerOptions properties were Deprecated
 * `serviceWorkerPath` was renamed to `path`
 * `swConfig` was renamed to `swPrecacheConfig`
 * Both still work, but will break in a future release.


## [0.4.1] - 2016-08-24

### Fixed
* No longer modifies the object passed to `generateServiceWorker()` – https://github.com/Polymer/polymer-build/pull/27

## [0.4.0] - 2016-08-05

### Fixed
* Don't halt building when encountering imports of absolute URLs (i.e. https://example.com/font.css).

### Added
* Generate `.d.ts` files for typescript users.

