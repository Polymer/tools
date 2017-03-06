[![NPM version](http://img.shields.io/npm/v/polymer-analyzer.svg)](https://npmjs.org/package/polymer-analyzer)
[![Build Status](https://travis-ci.org/Polymer/polymer-analyzer.svg?branch=master)](https://travis-ci.org/Polymer/polymer-analyzer)
# Polymer Analyzer

A static analysis framework for Web Components.

## Install
```
npm install polymer-analyzer
```

## Usage
```js
const {Analyzer, FSUrlLoader} = require('polymer-analyzer');

let analyzer = new Analyzer({
  urlLoader: new FSUrlLoader(pathToPackageRoot),
});

analyzer.analyze('/path-to-polymer-element.html')
  .then((document) => {
    for (const element of document.getFeatures({kind: 'element'})) {
      console.log(element);
    }
  });
```

## Developing

Polymer Analyzer is supported on Node LTS (4.4) and stable (6.3). It is written
in TypeScript 2.0. All development dependencies are installed via npm.

```sh
npm install
npm test
```

Or watch the source for changes, and run tests each time a file is modified:

```sh
npm run test:watch
```
## Looking for Hydrolysis?

Hydrolysis has been renamed to Polymer Analyzer for version 2. You can find the
hydrolysis source on the
[`hydrolysis-1.x`](https://github.com/Polymer/polymer-analyzer/tree/hydrolysis-1.x)
branch.
