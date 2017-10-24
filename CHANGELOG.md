# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased
<!-- Add new, unreleased changes here. -->

## [2.1.1] - 2017-10-23
* Updated `polymer-bundler` to 3.1.1, to fix an issue with deprecated CSS imports being inlined into the wrong templates.

## [2.1.0] - 2017-10-02
* Updated `polymer-bundler` to 3.1.0, which inlines external stylesheet links in templates.

## [2.0.0] - 2017-07-18
* [Breaking] Upgraded `polymer-bundler` to 3.x, which includes new default behavior around the `rewriteUrlsInTemplates` option in support of Polymer 2.x defaults.  Polymer 1.x project developers should set the option `rewriteUrlsInTemplates: true`.  See [using polymer-bundler programmatically](https://github.com/polymer/polymer-bundler#using-polymer-bundler-programmatically) for more information.

## [1.6.0] - 2017-06-29
* Automatically recognize any lazy-imports encountered as fragments when generating push-manifest.
* The `addPushManifest` feature now honors the laziness of html-imports and excludes them from the set of their importers' pushed assets.
* Upgraded Polymer Bundler to 2.2.0, which updated the shell strategy so that the shell is no longer linked to from other bundles. See [Bundler issue #471](https://github.com/Polymer/polymer-bundler/issues/471) for more details.

## [1.5.1] - 2017-06-02
* Prefetch links are now only added for transitive dependencies.

## [1.5.0] - 2017-05-23
* Service Worker generator now generates relative URLs for pre-cached assets instead of absolute. This makes it possible to cache assets when the app is served from a non-root path without re-mapping all URLs. Since server workers fetch relative to their own URL, there is no effective change for service workers served from the root path.
* Service Worker generator now better caches the entrypoint by setting navigateFallback and related options.

## [1.4.2] - 2017-05-19
* Updated the AddPrefetchLinks transform to not insert html root element tags like `<html>`, `<head>` or `<body>`.

## [1.4.1] - 2017-05-18
* Updated dependency on `polymer-bundler` to use official 2.0.0 release and enable unmediated semver upgrades.
* Fixed issue with push manifest URLs being a mix of relative and absolute URLs (now always relative), and a double-delimiter issue when using basePath.

## [1.4.0] - 2017-05-18

* Added `PolymerProject.addPrefetchLinks()` transform.
* Added `PolymerProject.addBabelHelpersInEntrypoint()` transform.

## [1.3.1] - 2017-05-16

* Updated polymer-project-config dependency.

## [1.3.0] - 2017-05-15

* A prefix can now be passed to `addPushManifest()`, which will be prepended to all push manifest resource paths.
* A basePath can now be passed to the service worker generator, where it will be used as the sw-precache replacePrefix.
* Upgrade to Polymer Analyzer that changes many errors to warnings for more robust builds.

## [1.2.5] - 2017-05-15

* Updated `polymer-analyzer` dependency to `^2.0.0` now that it is out of alpha.

## [1.2.4] - 2017-05-11

* Simplify addCustomElementsEs5Adapter() adapter injection method.
* Bundler stream no longer emits any CSS or Javascript files which have been inlined into bundles.

## [1.2.3] - 2017-05-10

* Dependency updates. Fixes issue with `polymer-bundler`'s handling of `lazy-import` links in `dom-modules`.

## [1.2.2] - 2017-05-09

* Dependency updates. Update to `sw-precache@5` to prevent "corrupted data" errors on Firefox 52 and Chrome 59 when using `addServiceWorker()`.  Upgraded `polymer-bundler` and `polymer-analyzer` to address `lazy-import` bugs.

## [1.2.1] - 2017-05-03

* Dependency updates. Upgraded to new `polymer-bundler`.  Most important update is a fix to bug whereby `lazy-import` links were being moved out of their `<dom-module>` containers.

## [1.2.0] - 2017-05-02

* Dependency updates.  Upgraded to new `polymer-bundler`, `polymer-analyzer` and `dom5` versions.
* Fixed bug where `<html>`, `<head>` and `<body>` were added to documents mutated by `HtmlSplitter` and the `CustomElementsES5AdapterInjector`.
* Print build-time warnings and errors with full location information, and precise underlines of the place where the problem was identified.
* Fixed issue where two copies of entrypoint files with same name are emitted by bundler stream: an un-bundled one, followed by bundled one.
* Fixed issue where html imports were emitted by bundler as individual files even though they were bundled.
* Added an options argument to `PolymerProject#bundler()` to support users configuring the bundler.  Options include all `Bundler#constructor` options, `analyzer`, `excludes`, `inlineCss`, `inlineScripts`, `rewriteUrlsInTemplates`, `sourcemaps`, `stripComments`, as well as `strategy` and `urlMapper` which are used on call to `Bundler#generateManifest`.

## [1.1.0] - 2017-04-14

* Add `addCustomElementsEs5Adapter()` method to PolymerProject. Provides an adapter needed when serving ES5 to browsers that support the native Custom Elements API.

## [1.0.0] - 2017-04-11

* [Breaking] Remove Node v4 support: Node v4 is no longer in Active LTS, so as per the [Polymer Tools Node.js Support Policy](https://www.polymer-project.org/2.0/docs/tools/node-support) polymer-build will not support Node v4. Please update to Node v6 or later to continue using the latest verisons of Polymer tooling.
* New Feature: add automatic [HTTP/2 push manifest](https://github.com/GoogleChrome/http2-push-manifest) generation for HTTP/2 Push-enabled servers.

## [0.9.1] - 2017-03-20

* Fixed issue with Service Worker generation in Windows environment where full paths were put into its precacheConfig instead of relative paths.
* Bundled files always use canonical platform separators in their paths now.  Previously, files might have either back-slashes or forward-slashes on Windows, depending on how they arrived at the Bundler and this caused the Analyzer to treat files as missing when mapping them by path.

## [0.9.0] - 2017-03-15

* [breaking] PolymerProject's `bundler` property is now a `bundler()` method, returning a new BuildBundler stream on each call.  This is to support parallel pipelines using bundler.

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
