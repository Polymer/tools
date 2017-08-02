# html2js

[![Build Status](https://travis-ci.com/Polymer/html2js.svg?token=x6MxFyUe7PYM8oPW9m6b&branch=master)](https://travis-ci.com/Polymer/html2js)

html2js is a tool to convert packages of HTML imports to JavaScript modules.

## Goals

The goal of the tool is to allow Polymer and Polymer elements to be converted to JavaScript modules with as litle intervention as possible. The tool will try to strike a balance between supporting the general semantics of HTML imports and generating the idiomatic JavaScript that would have been written without them.

## Status

html2js is under heavy construction and only barely usable on the Polymer core library as of now. We are still fixing issues and adding support for Polymer elements.

## Breaking changes

Converting HTML to modules involves a few breaking changes. See [./docs/breaking_changes.md](./docs/breaking_changes.md).

## Contributing

### Building and Testing

```sh
git clone https://github.com/Polymer/html2js.git
cd html2js
yarn install
npm test
```

### Running on Polymer

```sh
npm link
cd ../polymer
html2js
```

The converted files are now in the directory `js_out`
