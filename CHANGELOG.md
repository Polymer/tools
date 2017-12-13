# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Convert Closure `Object` to TypeScript `object`.

## [0.3.0] - 2017-12-12
- `void` is not nullable.
- Support constructor functions (e.g. `function(new:HTMLElement, string)`).
- Support record types (e.g. `@param {{foo: bar}}`).
- Include method `@return` descriptions.

## [0.2.0] - 2017-12-08
- Many fixes. See https://github.com/Polymer/gen-typescript-declarations/issues/23.

## [0.1.0] - 2017-11-09
- Initial release on NPM.
