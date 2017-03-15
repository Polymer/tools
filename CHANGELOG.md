# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

### New Lint Rules
- `databind-with-unknown-property` - Warns when a polymer element's databindings use properties that aren't declared on that element.
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
