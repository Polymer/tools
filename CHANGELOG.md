# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).


<!--
  Please document PR changes here. Uncomment the Unreleased header as
  appropriate.
-->

## Unreleased

- [BREAKING] Dropped support for node v4, added support for node v8. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support) for details.

## 1.4.0 - 2017-04-10

- [Polymer]: support autocompletion, tooltips, and jump to definition inside Polymer databinding expressions.
- By default, report and update warnings for all open files. Ignore warnings for a file when it is closed.
- Support the `polymer-ide.analyzeWholePackage` setting. When true, warnings will be reported for all files in the package, not just those that are open. Warnings will be more accurate but the initial analysis will be slower.
- Also generate autocompletion of elements for unclosed tagNames

## 1.3.3 - 2017-03-20

- Update the linter to get a ton of new rules.
- Configure the legacy interface (used by Atom) to read polymer.json, which will cause Atom to start seeing warnings from the linter.
- A ton of bug fixes, especially around Polymer 2.0 elements.

## 1.3.2 - 2017-03-03

### Fixed

* Fixed issue with url construction. This really should be the last one.

## 1.3.1 - 2017-03-03

### Fixed

* Forward logging over the LSP connection. This solves an issues where the ide would silently stop working, or work for some projects but not others. See: https://github.com/Polymer/vscode-plugin/issues/48
* Includes a number of powerful new lint passes. See [polymer-linter](https://github.com/Polymer/polymer-linter/blob/master/CHANGELOG.md#015---2017-03-03) for more info. Remember that you must configure your lint passes in polymer.json.

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
