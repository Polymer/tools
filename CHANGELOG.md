# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->

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
