# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!--## Unreleased-->

<!-- Please document PR changes here. -->

## 1.3.0 - 2017-01-22

### Added

* Hooked up the new configurable [polymer-linter](https://github.com/Polymer/polymer-linter) into the editor service. Use polymer.json to configure it.

### Fixed

* Handle paths more consistently and more correctly, especially paths containing characters which must be encoded when in a URL (e.g. spaces, and all paths on Windows).
  * Handle windows-style file:// urls as well. This should finally bring full support to windows!
* Updated dependencies.


## 1.2.0 - 2017-01-13

### Added

* Added autocompletion for attribute values based on property information.

### Fixed

* No longer warn for ES6 module or async/await syntax.
* Fix several classes of race condition and deadlock that could result in a variety of incorrect warnings.
* [Polymer] Extract pseudo elements from HTML comments
* [Polymer] Property descriptors are allowed to be just a type name, like `value: String`.

## 1.1.1 - 2016-11-21

### Changed

* `expandToSnippet` of element typeahead autocompletions now includes children corresponding to shadow dom slots.

## 1.1.0 - 2016-11-07

### Added

* Added initial support for finding references of the custom elements from an HTML usage of the element.

### Changed

* `expandToSnippet` of element typeahead autocompletions now returns a smart tabbing snippet.

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
