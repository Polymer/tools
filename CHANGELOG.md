# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

## [0.6.0] - 2017-01-14

* **Interface Update!** `PolymerProject.analyzer` is no longer a required step in your build pipeline. Instead, analysis happens automatically while it fills the `project.sources()` and `project.dependencies()` streams with your project files. See [the README](/README.md) for updated examples of what build streams look like without the analyzer.
* **[`merge-stream`](https://www.npmjs.com/package/merge-stream) users:** Update to v1.0.1 or later if you are using `merge-stream` with `polymer-build`. Stream errors do not propagate properly in previous versions of the library, and your build task may silently fail as a result.
* `StreamAnalyzer` is now `BuildAnalyzer` (since it is no longer a stream). This change only affects uses who are importing and/or using `StreamAnalyzer` directly from the `polymer-build` module.
* Fix issue where behaviors were not being analyzed properly.
* Update the version of polymer-analyzer we use, fixing a number of errors.

<details>
  <summary><strong>v0.6.0 Pre-Release Changelog</strong></summary><p>

### [0.6.0-alpha.3] - 2016-12-19

* Actually update the version of polymer-analyzer we use, fixing a number of errors. (alpha.2 was accidentally a noop release).

### [0.6.0-alpha.2] - 2016-12-19

* Update the version of polymer-analyzer we use, fixing a number of errors.

### [0.6.0-alpha.1] - 2016-12-13

* **Interface Update!** `PolymerProject.analyzer` is no longer a required step in your build pipeline. Instead, analysis happens automatically while it fills the `project.sources()` and `project.dependencies()` streams with your project files. See [the README](/README.md) for updated examples of what build streams look like without the analyzer.
* **[`merge-stream`](https://www.npmjs.com/package/merge-stream) users:** Update to v1.0.1 or later if you are using `merge-stream` with `polymer-build`. Stream errors do not propagate properly in previous versions of the library, and your build task may silently fail as a result.
* `StreamAnalyzer` is now `BuildAnalyzer` (since it is no longer a stream). This change only affects uses who are importing and/or using `StreamAnalyzer` directly from the `polymer-build` module.
* Fix issue where behaviors were not being analyzed properly.

</p></details>

## [0.5.1] - 2016-12-02

* Updated polymer-analyzer to `2.0.0-alpha.18`

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

