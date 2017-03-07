# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->

<!-- List New Changes Here -->

## [0.8.4] - 2017-03-04

* Build now delegates authority to the Analyzer for what urls are package external instead of local heuristics.
* Bundling now processes files coming in from streams, to support things like js-minification before bundling.

## [0.8.3] - 2017-03-03

* Dependency updates.

## [0.8.2] - 2017-02-24

* Dependency updates

## [0.8.1] - 2017-02-17

* Update the version of `polymer-bundler` to fix several bugs:
 * Fix regressions in url attribute updating (src, href, assetpath).
 * Added support for `<base>` href and target attribute emulation on bundled output.
 * Whitespace-agnostic license comment deduplication.
 * Server-side includes no longer stripped as comments.

## [0.8.0] - 2017-02-14

* `project.splitHtml()` & `project.rejoinHtml()` methods have been pulled off of `PolymerProject` so that multiple streams can split/rejoin in parallel. See [the new README section on `HTMLSplitter`](https://github.com/Polymer/polymer-build#handling-inlined-cssjs) for updated instructions on how to split/rejoin inline scripts and styles in your build stream.
* Completed the migration away from `hydrolysis` to `polymer-analyzer` and `vulcanize` to `polymer-bundler`.
* Do a better job of only listing warnings for code in the package being built.

## [0.7.1] - 2017-02-03

* Fix issue where larger projects would cause the sources stream to hang.

## [0.7.0] - 2017-01-31

* `BuildAnalyzer.sources` & `BuildAnalyzer.dependencies` are now `BuildAnalyzer.sources()` & `BuildAnalyzer.dependencies()`, respectively. This change only affects uses who are importing and/or using the `BuildAnalyzer` class directly.
* Fix issue where files were being loaded immediately, before the build stream was started.


## [0.6.0] - 2017-01-04

* Fix issue where missing source files were causing silent stream failures.
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
