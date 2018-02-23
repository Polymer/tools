# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

* Add `deleteFiles` option and `--delete-files` flag to delete all
  files/directories matching some glob patterns after conversion.
* If a package already has a `package.json`, it will be merged with the newly
  generated one.
* Added `--flat` and `--private` CLI flags to control those options in the new
  `package.json`. Both default to `false`.
<!-- Add new, unreleased changes here. -->

## [0.3.0] - 2017-11-28

* TONS of conversion improvements, almost too many to list!
* Replaces slow/fragile nodegit with much faster polymer-workspaces git workflow
* New: Generates symlinked `node_modules` folder after workspace conversion
* New: Can support conversions with multiple import url styles ("path", "name")

