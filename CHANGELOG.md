# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

* Compile JavaScript with Babel for browsers that don't support ES6

## [0.14.0] - 2016-11-17

* Added support for HTTP2 and HTTP2 Push. PR #98
* TypeScript declaration fixes

## [0.13.0] - 2016-09-30

### Fixed
* Return a 404 for missing resources with known file extensions rather than serving out `index.html`. PR #102

## [0.12.0] - 2016-05-17

### Fixed
* The `openPath` option should override the component path. PR #95

## [0.11.0] - 2016-05-12

### Added
* Option to customize the URL top open the browser to. #81

### Fixed
* Don't serve out the `index.html` shell file for paths ending in `.html`.
* Make the browser opening behavior more configurable and predictable. #81
