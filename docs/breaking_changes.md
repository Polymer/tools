A list of known limitations and behavior changes when using HTML2JS:

## Common

- Relative URLs
  - URLs in CSS are not relativized like they were as HTML documents
  - Polymer.ResolveUrl doesn't have relative URL information

- Polymer.importHref uses HTML Imports and is not supported.
  - most users should switch to using [dynamic imports](https://github.com/tc39/proposal-dynamic-import)
  - uses that must have HTML Imports should ensure they're loading the polyfill
    and use the [imperative API](https://stackoverflow.com/a/21649225/101).

- `'use strict'` is implied in modules code
  - e.g. assigning to an undeclared variable is an error

## Rare

- ElementClass.template
  - this is a rarely used static property on the element class. when the template
    is defined using a dom-module it is an HTMLTemplateElement, but after inlining it is a string.

- `document.currentScript`
  - this was a way to get access to the script element of the currently executing
    script. it is `null` in a module.
