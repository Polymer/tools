# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->

## [0.19.0](https://github.com/PolymerLabs/polyserve/tree/v0.19.0) (2017-05-08)

* Add auto-compile support for the Mobile Safari browser.
* Add auto-compile support for the Vivaldi browser.
* Fixed issue when serve with --push-manifest ([#168](https://github.com/Polymer/polyserve/issues/168))
* Add gzip and deflate HTTP response compression.

## [0.18.0](https://github.com/PolymerLabs/polyserve/tree/v0.18.0) (2017-04-18)

* When compiling to ES5, inject the Custom Elements ES5 Adapter into any HTML
  file where the web components polyfill is included (typically the entry
  point). This adapter is needed when serving ES5 to browsers that support the
  native Custom Elements API
  ([#164](https://github.com/Polymer/polyserve/issues/164)).
* A server can now be started with a custom entry point; previously index.html
  was always assumed ([#161](https://github.com/Polymer/polyserve/issues/161)).

## [0.17.0](https://github.com/PolymerLabs/polyserve/tree/v0.17.0) (2017-04-13)

* Add auto-compile support for the Chromium browser.
* Add auto-compile support for the Opera browser.
* Require ES5 compilation for Edge < 40 ([#161](https://github.com/Polymer/polyserve/issues/161)).
* Fixed issue where directory paths redirected to the file system ([#96](https://github.com/Polymer/polyserve/issues/96)).
* [Breaking] Remove Node v4 support: Node v4 is no longer in Active LTS, so as per the [Polymer Tools Node.js Support Policy](https://www.polymer-project.org/2.0/docs/tools/node-support) polyserve will not support Node v4. Please update to Node v6 or later to continue using the latest verisons of Polymer tooling.

## [0.16.0](https://github.com/PolymerLabs/polyserve/tree/v0.16.0) (2017-02-14)

### Added
* `-u`/`--component-url` option to support expressing different url to
  fetch components from than `components`.

### Fixed
* When no port is given, do a better job of finding an available port.
 * Uses the list of [sauce-legal](https://wiki.saucelabs.com/display/DOCS/Sauce+Connect+Proxy+FAQS#SauceConnectProxyFAQS-CanIAccessApplicationsonlocalhost?) ports.

## [0.15.0](https://github.com/PolymerLabs/polyserve/tree/v0.15.0) (2016-11-28)

### Added

* Compile JavaScript with Babel for browsers that don't support ES6. A new
`--compile` flag controls compilation, with valid values of 'always', 'never',
and 'auto'; and a default of 'auto'.
* If the root dir contains directories that look like `bower_components-${foo}`,
they will be treated as `dependency variants`. In that case, polyserve will
start one server for each variant, enabling testing and development of your code
against each set of dependencies.

## [0.14.0](https://github.com/PolymerLabs/polyserve/tree/v0.14.0) (2016-11-17)

* Added support for HTTP2 and HTTP2 Push. PR #98
* TypeScript declaration fixes

## [0.13.0](https://github.com/PolymerLabs/polyserve/tree/v0.13.0) (2016-09-30)

### Fixed
* Return a 404 for missing resources with known file extensions rather than serving out `index.html`. PR #102

## [0.12.0](https://github.com/PolymerLabs/polyserve/tree/v0.12.0) (2016-05-17)

### Fixed
* The `openPath` option should override the component path. PR #95

## [0.11.0](https://github.com/PolymerLabs/polyserve/tree/v0.11.0) (2016-05-12)

### Added
* Option to customize the URL top open the browser to. #81

### Fixed
* Don't serve out the `index.html` shell file for paths ending in `.html`.
* Make the browser opening behavior more configurable and predictable. #81
