# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Static methods are now supported on classes, elements, and mixins.
- Add `renameTypes` config option, a map of renames to apply to named types that can be configured per-project.
- Convert Closure `ITemplateArray` type to TypeScript `TemplateStringsArray`.

## [0.3.1] - 2017-12-15
- Convert Closure `Object` to TypeScript `object`.
- Use glob patterns instead of RegExps to exclude files.
- Bump Analyzer version to include https://github.com/Polymer/polymer-analyzer/pull/791 which makes Polymer properties possibly `null|undefined`.

## [0.3.0] - 2017-12-12
- `void` is not nullable.
- Support constructor functions (e.g. `function(new:HTMLElement, string)`).
- Support record types (e.g. `@param {{foo: bar}}`).
- Include method `@return` descriptions.

## [0.2.0] - 2017-12-08
- Many fixes. See https://github.com/Polymer/gen-typescript-declarations/issues/23.

## [0.1.0] - 2017-11-09
- Initial release on NPM.
