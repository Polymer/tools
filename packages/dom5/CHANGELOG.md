# Change Log

## [v2.1.0](https://github.com/Polymer/dom5/tree/v2.1.0) (2017-01-13)

- **Added** Option to node traversal methods to traverse templates

## [v2.0.1](https://github.com/Polymer/dom5/tree/v2.0.1) (2016-11-01)
- TypeScript type definition fixes

## [v2.0.0](https://github.com/Polymer/dom5/tree/v2.0.0) (2016-09-23)
- Upgraded to `parse5@^v2.2.1`.
- (*breaking*) Because parse5 2.x correctly handles `<template>` elements,
  the nodeWalk* and query* functions will no longer return results from within
  `<template>`s. Code that relied on this must explicitly walk into template
  content documents.
- (*breaking*) Removed `parse()`, `parseFragment()` and `serialize()`. Use
  `parse5.parse()`, etc., instead.
- Nodes can be appended to parents with a `null` `childNodes` array.
- DocumentFragments that are appended have their `childNodes` array cleared,
  rather than getting a new empty `childNodes` instance.
