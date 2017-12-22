# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).


<!--
  Please document PR changes here. Uncomment the Unreleased header as
  appropriate.
-->

<!-- ## Unreleased -->

## 2.1.0 - 2017-12-21

- Autocomplete slot names inside `slot=""` attributes based on the declared
  slots of the parent element.
- Autocomplete css custom property names. In use sites, complete to any
  declaration, in declaration sites complete to any declaration or usage.
- Make reference count code lenses opt-in, as it currently does not perform
  well for large projects, because of:
  https://github.com/Polymer/polymer-analyzer/issues/782
  - New setting `polymer-ide.referencesCodeLens`, which is false by default.
    When true, we will send down references code lenses.
- Added configurable logging for common issues:
  - Analysis performance, which can cause editors to seem unresponsive or
    broken.
  - File synchronization messages, as editors often need a bit of
    configuration for these to go through right.
  - New setting `polymer-ide.logToClient`, false by default. When true, it
    sends logs to the editor for it to log.
  - New setting `polymer-ide.logToFile`, a string path to a file. When given,
    logs are appended to this file (in addition to possibly going to the
    client).
- Add autocompletion for standard custom element definition.
- Give ranges when we give hover documentation for elements and attributes.
  This lets the client indicate to the user exactly which code is being
  documented.
- Send down autocompletion documentation as markdown to clients that support it.
- Greatly improve Windows support. Added Windows integration testing through
  appveyor.

## 2.0.0 - 2017-12-05

- [BREAKING] Removes our proprietary protocol in favor of the Language Server
  Protocol. Using the standard protocol lets us support more editors with less
  code.
- Notices changes to `polymer.json` immediately. Currently this is useful for
  changing lint rules without reloading your editor.
- Supports filtering out warning codes with the `polymer.json` field
  `lint.ignoreWarnings` which takes an array of warning codes that we should
  not report. This brings the IDE in line with `polymer lint` on the command
  line.
- Supports specifying files to ignore all warnings for with the `polymer.json`
  field `lint.filesToIgnore` which takes an array of `minimatch` globs. If a
  file matches any of those globs then we will never report a warning for it.
- Supports finding all references for elements. Finds references to the element
  in HTML tags.
- Supports getting all symbols in the workspace and in the document. At the
  moment we just expose elements by tagname and Polymer 1.0 core features, as
  other symbols should be well handled by other language services.
- Supports finding definitions and all references of CSS Custom Properties.
  - When finding definitions of the property it will return all places where
    the property is assigned to.
  - When finding all references it will find all places where the property
    is read with `var(--foo)` or `@apply --bar` syntax.
- Supports filtering autocompletions on the server side if the client does not.
  Clients without autocompletion filtering support should send over
  `capabilities.experimental['polymer-ide'].doesNotFilterCompletions` as `true`
  in their client capabilities.
- Reports errors in `polymer.json` files, including invalid data, and unknown
  lint rules.
- Supports code lenses to display information inline with your code.
  - At a custom element declaration, displays how many places it's referenced
    in HTML.
  - At CSS Custom Property assignments, displays how many places it's read.

## 1.6.0 - 2017-11-21
- Generate Code Actions for fixable warnings and warnings with edit actions.
- Update to the latest version of the linter, with many new Polymer 2.0 and hybrid lint passes.
<img src="https://user-images.githubusercontent.com/1659/32974665-cc51d1e2-cbb4-11e7-9a20-9162323cdab8.gif" alt="Code Actions" width="658" height="474">

- Added a setting `polymer-ide.fixOnSave` that, when true, causes all warnings in the current file to be fixed whenever that file is saved.
<img src="https://user-images.githubusercontent.com/1659/32983803-946aabaa-cc4f-11e7-90ca-a63e8c437037.gif" width="821" height="588">

- Added support for the command `polymer-ide/applyAllFixes`. This is a zero argument command that calls `workspace/applyEdit` with a `WorkspaceEdit` that applies all non-overlapping fixes for all fixable warnings in the package.
- Warnings should now immediately be updated in response to any change, whether it happens in the editor or from external tools, like `bower install`.
- Added `polymer-editor-service` as an npm binary, which speaks the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) over stdin/stdout. This makes it easier to get started integrated the editor service into a new editor.

## 1.5.0 - 2017-08-01

- [BREAKING] Dropped support for node v4, added support for node v8. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support) for details.
- Updated to the latest stable version of the analyzer, including support for many new annotations and a large number of bugfixes.

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
