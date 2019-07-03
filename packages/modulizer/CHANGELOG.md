# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->
<!-- Add new, unreleased changes here. -->

## [0.4.3] - 2018-12-20

* Update dependency map to use @polymer/iron-component-page 4.0.0.

## [0.4.2] - 2018-12-19

* Fix regression in conversion of `Polymer.Element` => `PolymerElement`
  affecting latest Polymer 2.x source.
* Update dependency map to use stable 3.0.0 releases.

## [0.4.1] - 2018-07-10

* Fix error where package js-yaml couldn't be found
* Remove `npm run format` and `npm run update-types` from Travis config
* Fix npm audit warnings
* Update wct-browser-legacy version
* Don't set display: none on generated <template> elements

## [0.4.0] - 2018-05-11

* In Polymer, 'polymer.html' is renamed during conversion to 'polymer-legacy.js'
  instead of 'polymer.js' and `Polymer.Element` (from 'polymer-element.html')
  is now exported as `PolymerElement` instead of `Element`.
* The `--include` flag has been removed. Entrypoints for packages are now read
  from the `main` field of packages' `bower.json`.
* Add `deleteFiles` option and `--delete-files` flag to delete all
  files/directories matching some glob patterns after conversion.
* If a package already has a `package.json`, it will be merged with the newly
  generated one.
* Added `--flat` and `--private` CLI flags to control those options in the new
  `package.json`. Both default to `false`.
* `deleteFiles` option will no longer delete any file from `node_modules/` or
  `bower_components/`.
* Preserve comments more reliably.
* Allow Modulizer to run in directories that are not Git repositories.

## [0.3.0] - 2017-11-28

* TONS of conversion improvements, almost too many to list!
* Replaces slow/fragile nodegit with much faster polymer-workspaces git workflow
* New: Generates symlinked `node_modules` folder after workspace conversion
* New: Can support conversions with multiple import url styles ("path", "name")
