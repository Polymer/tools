# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

<!-- New PRs should document their changes here. -->

## [0.5.0] - 2016-11-01

* **New Analyzer!** Should fix most reported bugs that were caused by bad analysis, but may introduce new ones. Be sure to test your build after upgrading to confirm that your build is still functioning. See [`polymer-analyzer`](https://github.com/Polymer/polymer-analyzer) for more information.
  * Fixed silent failures during build analysis.
  * Added warning printing during build analysis (#54).
* Added support for relative `root` paths.
* Renamed two `AddServiceWorkerOptions` properties:
 * `serviceWorkerPath` was renamed to `path`.
 * `swConfig` was renamed to `swPrecacheConfig`.
 * Old names are deprecated, and support for them will be removed in future versions.
* polymer.json configuration now managed by [`polymer-project-config`](https://github.com/Polymer/polymer-project-config)
* Upgrade outdated dependencies:
  * `sw-precache@4.2.0` generates a new kind of service-worker that will require all users to repopulate their cache. Otherwise it continues to behave the same as before.

## [0.4.1] - 2016-08-24

### Fixed
* No longer modifies the object passed to `generateServiceWorker()` – https://github.com/Polymer/polymer-build/pull/27

## [0.4.0] - 2016-08-05

### Fixed
* Don't halt building when encountering imports of absolute URLs (i.e. https://example.com/font.css).

### Added
* Generate `.d.ts` files for typescript users.

