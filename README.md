[![NPM version](http://img.shields.io/npm/v/polymer-analyzer.svg)](https://npmjs.org/package/polymer-analyzer)
[![Build Status](https://travis-ci.org/Polymer/hydrolysis.svg?branch=2.0)](https://travis-ci.org/Polymer/hydrolysis)
# Polymer Analyzer

A static analysis framework for Web Components.

## Install
```
npm install polymer-analyzer
```

## Usage
```js
const Analyzer = require('polymer-analyzer/analyzer').Analyzer;
const FSUrlLoader = require('polymer-analyzer/url-loader/fs-url-loader').FSUrlLoader;

let analyzer = new Analyzer({
  urlLoader: new FSUrlLoader(pathToPackageRoot);
});

analyzer.analyze('/path-to-polymer-element.html')
    .then((document) => {
      console.log(document.entities);
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
