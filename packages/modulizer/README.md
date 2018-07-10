# polymer-modulizer

[![Build Status](https://travis-ci.com/Polymer/polymer-modulizer.svg?token=x6MxFyUe7PYM8oPW9m6b&branch=master)](https://travis-ci.org/Polymer/polymer-modulizer)
[![Windows Build Status](https://ci.appveyor.com/api/projects/status/koepsxxwhl6reof8/branch/master?svg=true)](https://ci.appveyor.com/project/FredKSchott/polymer-modulizer/branch/master)

Convert Polymer 2.x projects to Polymer 3.x.
.
## Overview

polymer-modulizer, aka Modulizer, converts Bower packages using HTML Imports to npm packages using JavaScript modules. It automatically rewrites code to upgrade your projects and elements. In fact, the Polymer team used modulizer to upgrade the Polymer Elements, and Polymer itself!

Modulizer performs many different upgrade tasks, like:
 * Detects which `.html` files are used as HTML Imports and moves them to `.js`
 * Rewrites `<link rel="import>` in HTML to `import` in JS.
 * Removes "module wrappers" - IIFEs that scopes your code.
 * Converts `bower.json` to `package.json`, using the corresponding packages on npm.
 * Converts "namespace references" to the proper JS module import, ie: `Polymer.Async.timeOut` to `timeOut` as imported from `@polymer/polymer/lib/util/async`.
 * Creates exports for values assigned to namespace referencs. ie, `Foo.bar = {...}` becomes `export const bar = {...}`
 * Rewrites namespace objects - an object with many members intended to be used as a module-like object, to JS modules.
 * Moves Polymer element templates from HTML into a JS template string.
 * Removes `<dom-module>`s if they only contained a template.
 * Moves other generic HTML in the document into a JS string and creates it when the module runs.

Modulizer then writes out a file that records what changes it made. This file can be published to npm along with the new package, so that dependencies of your package can also automatically be upgraded with modulizer.

Modulizer will also install dependencies from npm, run tests, push to a git branch and publish to npm for you! And modulizer has a "workspace" mode where it will do this for entire collections of packages at once.

Modulizer tries to update everything it can, but some manual changes may be necessary. In particular:
 * Modules are always in strict mode and scoped. Modulizer does not fix strict mode errors.
 * If you use `importHref` you'll need to change to use dynamic `import()`.
 * Some APIs, like `document.currentScript` are not available in JS modules.
 * Modulizer does not understand other modules systems like AMD or CommonJS. If you use those, you'll have to update them to JS modules manually.

### Example

```html
<link rel="import" href="../polymer/polymer-element.html">

<dom-module id="my-element">
  <template>
    <h2>Hello Modules!</h2>
  </template>
  <script>
    Polymer.MyElement = class extends Polymer.Element {
      static get is() { return 'my-element'; }
      // ...
    }
    window.customElements.define(MyElement.is, MyElement);
  </script>
</dom-module>
```

Converts to:

```javascript
import { PolymerElement } from '../../@polymer/polymer/polymer-element.js';
import { html } from '../../@polymer/polymer/lib/utils/html-tag.js';

export const MyElement = class extends PolymerElement {
  static get template() {
    return html`
      <h2>Hello Modules!</h2>
    `;
  }

  static get is() { return 'my-element'; }
  // ...
}
window.customElements.define(MyElement.is, MyElement);
```

## Usage

Install polymer-modulizer from npm:

```
npm install -g polymer-modulizer
```

`polymer-modulizer` has two modes: package mode, which converts the current directory as a package,
or workspace mode, which takes a list of GitHub repositories and creates a workspace out of them
(converting the repos and their dependencies at once).

### Local (package) mode

This converts the current directory as a `bower` package. You _must_ run `bower install` in
this directory before running modulizer. The following command will convert the files and
add the new ones in the current directory:

```sh
bower cache clean && bower install
modulizer --out .
```

### Workspace mode

You must first generate a GitHub access token and store it in a file named `github-token`.

Then run:

```sh
modulizer owner/repo owner2/repo2
```

This will create a `modulizer_workspace` directory and checkout the repos and their Bower dependencies and convert them all in place. You can then run `polymer serve` in the workspace directory and try out the results in Chrome 61 or Safari 10.1 (or Edge and Firefox with the appropriate flags turned on).


## Conversion Options

#### `--import-style ["name"|"path"]`

Setting the import style allows you to set whether JavaScript imports are specified by npm package name, or relative file path. Importing specifiers that use package names are easier for third-party packages to work with, but unlike paths they currently can not run natively on the web. Defaults to "path".

#### `--add-import-meta

True by default; the static `importMeta` property will be added to converted Polymer elements. See [the `importPath` documentation](https://www.polymer-project.org/2.0/docs/devguide/dom-template) for more information.


## Conversion Guidelines

polymer-modulizer works best on well-structured projects, where each HTML file is conceptually a single module already, and references to objects other files, even though via globals, are kept to simple, declarative forms.

 1. All dependencies must be available as modules to convert.

    polymer-modulizer can convert your dependencies in a workspace, but in order to publish your package, you'll need your dependencies published as modules too. Now is a great time to contact the owners of project you depend on to get them to convert their components.

 1. If you need to make changes to your project to have it convert properly, make these to the original HTML source.

    The updated HTML-based project should be published as a new version so that client can upgrade to it before converting themselves.

 1. Make sure files are annotated correctly.

    Especially important are `@namespace` annotations on namespace objects.

    If your documentation, including namespaces, displays correctly in `iron-component-page`/`iron-doc-viewer` or webcomponents.org, it's a good sign it can be automatically converted.

 1. Be careful with multiple scripts in one file.

    Scripts are concatenated, so they could have name collisions.

    Tests, demos and other top-level HTML files aren't converted to JavaScript (just their references to HTML Imports are converted), so they are a little more flexible.

 1. Only export from the top-level of a script.

    JavaScript export can only appear at the top-level of a module, so assignments to namespace objects which serve as exports in HTML Imports can only be converted if they're at the top-level of a script.

    Scripts can have a single, top-level, IIFE, which is automatically unwrapped during conversion, and exports can appear in the top-level of that IIFE.

 1. Recommendation: Only include a single namespace definition per file.

    polymer-modulizer converts each HTML Import file to a module. If a file contains multiple namespaces they will be converted to exported objects, rather than their own module. You can break up HTML Imports into smaller, single-namespace-containing, files to generate separate modules.

 1. Don't change your API!

    Because polymer-modulizer automatically converts usage of dependencies from HTML to JavaScript modules, it has to assume that those dependencies have the same API it would have generated for them. That means that if you convert a package, and then change its API, that users who convert their components will have a much harder time getting their components working.

 1. Publish your converted package with a major version bump.

    Even though we recommend not making breaking API changes, the mere repackaging of HTML Imports to JavaScript modules is a breaking change. polymer-modulizer assumes that converted dependencies have a higher major version number.

 1. `importHref` and lazy-imports are not supported yet.

    We need wider dynamic `import()` support in Browsers to properly support dynamic loading and PRPL.


## Contributing

### Building and Testing

```sh
git clone https://github.com/Polymer/polymer-modulizer.git
cd polymer-modulizer
yarn install
npm test
```

### Running on Polymer

```sh
npm link
cd ../polymer
modulizer
```

The converted files are now in the directory `js_out`
