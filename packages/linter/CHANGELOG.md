# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->
<!-- Add new, unreleased changes here. -->

## [3.0.1] - 2018-06-28
* Fix NPM audit warnings.

## [3.0.0] - 2018-05-08
* Dropped support for node v6. This is a soft break, as we aren't
  making any changes that are known to break node v6, but we're no longer testing against it. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support)
  for details.

## [3.0.0-pre.7] - 2018-04-17
- Update for breaking Analyzer change.

## [3.0.0-pre.6] - 2018-04-11
- Bump dependencies.

## [3.0.0-pre.5] - 2018-04-05
- Accept AnalysisOptions as an argument to `Linter#lint` and
  `Linter#lintPackage`.

## [3.0.0-pre.4] - 2018-03-27

- Adds the new rule `iron-form-v1-to-v2`, which warns about `iron-form` being used as a type extension of `<form>`.
  - The fix automatically wraps the `<form is="iron-form">` into an `<iron-form>` and moves `id`, `with-credentials`, `headers` properties and `on-iron-form-*` events from `<form>` to `<iron-form>`.

## [3.0.0-pre.3] - 2018-03-07

### New Lint Rules
- `create-element-extension`: Warns when using the second parameter of `createElement` for element extension using the `is` attribute.
- `validate-element-name`: Warns when using an invalid element name or when there are potential issues or conflicts with the element name.
- `root-selector-to-html`: Warns when using the `:root` selector in `custom-style` or element styles.
- `custom-style-extension`: Warns when `<style>` is extended by `is="custom-style"` but not wrapped by `<custom-style>`.

### Fixes
- `content-selector-to-slotted`: Don't attempt to fix usages where a selector would come after `::slotted`

### Enhancements
- Make `dom-module-invalid-attrs` rule fixable for cases where only `is` or `name` exist, and both if they use the same values.


## [3.0.0-pre.2] - 2018-02-16
### New Lint Rules
- `dom-calls-to-native`: Warns when `Polymer.dom` is used where native methods/properties may
- `deprecated-shadow-dom-selectors`: Warns when deprecated Shadow DOM selectors are used. (`/deep/`, `>>>`, and `::shadow`)
- `content-selector-to-slotted`: Warns when deprecated `::content` selector is used. Can safely fix usages that use `>` selector.

## [3.0.0-pre.1] - 2017-12-21
- [BREAKING] Return an object with `warnings` and `analysis` properties
  rather than an array or warnings with an unenumerable `analysis`
  property.
- Add an explicit dependency on shady-css-parser. This fixes a bug where
  it is not always found, despite being a dependency of polymer-analyzer.
- Add a test for the `content-to-slot-usages` rule's updates to children
  of `<paper-icon-item>`.
- Improved compatibility with Windows. Added Windows CI with appveyor.

## [2.3.0] - 2017-11-20
- Adds the `paper-toolbar-v1-to-v2` rule, which helps upgrade uses of paper-toolbar from v1 to v2 (hybrid) by adding slots to children where appropriate.
- Improve the wording on the content-to-slot-declaration's unsafe edit action.

## [2.2.1] - 2017-11-16
- The array of warnings returned by `Linter#lint()` and `Linter#lintPackage()` now also has a non-enumerable `analysis` property, which refers to the immutable `Analysis` used to generate the lint results.
- Fixed `iron-flex-layout-classes` to handle `class$` attribute.

## [2.2.0] - 2017-11-13
- Added a concept of edit actions, which are like fixes with caveats. These need explicit user intent to apply because they may change the code's API, or otherwise be unsafe.
- Support warning about and automatically fixing some simple uses of some 1.0 elements to their 2.0 usage styles.
  - To add this fixable lint warning for your own elements, simply add the `old-content-selector` attribute to your new `<slot>` element. Set its value to the value that your old `<content>` element had for its `select` attribute.
    - e.g. if you had `<content select=".some-content">` and migrated to `<slot name="new-content" old-content-selector=".some-content">` then the linter will warn about and add `slot="new-content"` to children of your element that match `.some-content`.
- Support warning about and automatically fixing/editing element declarations that use `<content>` to use `<slot>` instead.
  - It automatically adds the `old-content-selector` attribute to migrated `<slot>` elements, so uses can be automatically upgraded as well.
- Support automatic fixing of the warning where a `<style>` element is a direct child of a dom-module's `<template>`.
- Support warning about and fixing usage of deprecated `iron-flex-layout/classes/*` files via the new rule `iron-flex-layout-import`
  - It automatically adds, updates, or deletes the import `iron-flex-layout/iron-flex-layout-classes.html`.
- Support warning about and fixing usage of iron-flex-layout classes without including the required style modules via the new rule `iron-flex-layout-classes`
  - It automatically upgrades the element template to include the iron-flex-layout style modules.

## [2.1.0] - 2017-10-13
- Warn for old-style @apply without parentheses, and var() with a fallback value of a bare css variable.
  - These are our first automatically fixable warnings. An upcoming version of the CLI and IDE will be able to automatically fix these warnings.

## [2.0.3] - 2017-08-23

- Fix handling of the `index-as` attribute on dom-repeat.

## [2.0.2] - 2017-05-15

- Upgraded dependency `polymer-analyzer` to ^2.0.0, to support its official release.

## [2.0.1] - 2017-05-09

- Upgraded dependency `polymer-analyzer` to 2.0.0-alpha.42, providing better method privacy inference, support for new JSDoc tags including those in HTML comments for custom elements, and better warnings for mixins, elements, and classes.

## [2.0.0] - 2017-04-14

- [BREAKING] Dropped support for node v4, added support for node v8. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support) for details.
- Fixed a number of issues with standalone javascript files referenced via `<script src="./foo.js">`. We now more reliably know about the context of the HTML in which they are imported, so that their dependencies are properly resolved.

## [1.0.2] - 2017-04-05

- Minor dependency bump.

## [1.0.1] - 2017-03-20

- Fix a bug where we were including warnings from dependencies when linting a package.

## [1.0.0] - 2017-03-15

### First major release!

- polymer-lint is now at feature parity with [polylint](https://github.com/PolymerLabs/polylint), and is ready to replace it!

### New Lint Rules
- `databind-with-unknown-property`: Warns when a polymer element's databindings use properties that aren't declared on that element.
- `element-before-dom-module`: Warns when a Polymer element is defined before its `<dom-module>` exists in the DOM.
- `databinding-calls-must-be-functions`: Computed functions, observers, and calls in databinding expressions must be either methods on the element or properties with types that could be function types.
- `call-super-in-callbacks`: Warns when a Polymer 2.0 element does not call super() in callbacks that require it, like `connectedCallback`.

### Fixes
- `set-unknown-attribute`
  - We weren't checking bindings on imported elements.
  - Warning for unknown attributes has too many false positives to be on by default. There are too many legit use cases for adding arbitrary attributes to elements. We'll add it as an option once we've got lint rule options hooked up.

## [0.1.6] - 2017-03-07

- Update polymer-analyzer to 1.0.0-alpha.31

## [0.1.5] - 2017-03-03

### New Lint Rules
- `behaviors-spelling`: Warns when the `behaviors` property may not have the American-English spelling
- `undefined-elements`: Warns when an HTML tag refers to a custom element with no known definition.
- `unbalanced-polymer-delimiters`: finds unbalanced delimiters in polymer databinding expressions.
- `unknown-set-attribute`: included in all polymer rule collections.
  - Warns when setting undeclared properties or attributes in HTML.

    This rule will check use of attributes in HTML on custom elements, as well
    as databinding into attributes and properties in polymer databinding
    contexts.

    This catches misspellings, forgetting to convert camelCase to kebab-case,
    and binding to attributes like class and style like they were properties.

    Currently only checks custom elements, as we don't yet have the necessary
    metadata on native elements in a convenient format.

## [0.1.4] - 2017-02-24

- bump version of the analyzer.

## [0.1.3] - 2017-02-22

- bump version of the analyzer.

## [0.1.2] - 2017-02-14

### Added

- allRules and allRuleCollections on the registry, for accessing all registered rules and collections.

## [0.1.1] - 2017-02-10

- The start of our rewrite of https://github.com/PolymerLabs/polylint on top of our new incremental static analysis framework.

### Added

- APIs for both linting by files and by package.
- Rule collections. Semantic, intent-based collections of lint rules.
- A queryable, extensible registry of rules and rule collections.

### New Lint Rules
- Rule that warns about `<style>` tags as direct children of `<dom-module>` tags (rather than being in `<template>` tags).
- Rule that warns about `is` and `name` attributes on `<dom-module>` tags.
