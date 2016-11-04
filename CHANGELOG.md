# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

<!-- Please document PR changes here. -->

### Added

* Added support for finding references of the custom elements from an HTML usage of the element.

## 1.0.2 - 2016-11-07

### Fixed
* Ok this time actually fix the contents of the NPM package. It turns out that the `files` property of `package.json` overrides all other configuration completelyin, including `.gitignore` and `.npmignore`. See `.npmignore` for how to test.

## 1.0.1 - 2016-11-07

### Fixed
* Fix the published assets in NPM. Add a missing dependency.

## 1.0.0 - 2016-11-07

* Initial standalone release (was previously part of the [polymer analyzer](https://github.com/Polymer/polymer-analyzer)).

### Major change

* We're standardizing on the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) so that we can support a larger number of editors with less code that is specific to Polymer and our editor service. Open protocols FTW!
  * Our old homegrown protocol, used by the atom and sublime text plugins is deprecated. We'll be updating those plugins to use the LSP in upcoming releases. ETA end of November 2016.

### Existing features:

* Supports getting documentation on mouse hover, getting a diagnostics (lint errors), jumping to the definition of custom elements and their attributes, and getting typeahead completions for custom elements and their attributes.

* Initial support for recognizing vanilla Custom Element v1 declarations, as well as Polymer 1.0 and 2.0 declarations.

* Plugins that use this language server:
  * [vscode](https://github.com/Polymer/vscode-plugin)
  * [atom](https://github.com/Polymer/atom-plugin)
  * [sublime text](https://github.com/Polymer/polymer-sublime-plugin)

