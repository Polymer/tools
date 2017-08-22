# polymer-modulizer

[![Build Status](https://travis-ci.com/Polymer/polymer-modulizer.svg?token=x6MxFyUe7PYM8oPW9m6b&branch=master)](https://travis-ci.com/Polymer/polymer-modulizer)

polymer-modulizer is a tool to convert packages of HTML imports to JavaScript modules.

## 🚧 Warning: Extremely Early Preview! 🚧

polymer-modulizer, and the output it generates, are very early versions. As far as we can tell, they mostly work, but they're still subject to bugs, unexpected behavior, breaking changes, and especially, too little documentation.

We are opening this tool now so we can work in the open, and to gather feedback on how well it works on your code. If you choose to use it:

 1. 🚿 Run the tool in a clean Git working directory, or use workspace mode. Do not run on uncommitted changes.
 2. 📞 Please report any issues you find!
 3. 👷🏽‍ Pardon the dust. Some parts of the workflow, like testing the output of multi-package conversions, are still under construction.
 4. 🔄 Be ready to update and run the tool again in the future to pick up changes in output.
 5. 📚 _If_ you want to publish the output of the tool, use a pre-release version and tag for now, until we can make stronger guarantees about the API of the output it generates.

Good luck, the future is exciting! 😎 Please join us for discussion in the [`#modulizer` Slack channel](https://polymer.slack.com/messages/G6R11FXEC/).

## Overview

polymer-modulizer is designed to convert HTML Imports, and especially those containing Polymer and Polymer elements, to JavaScript modules as automatically as possible.

polymer-modulizer tries to strike a balance between supporting the general semantics of HTML Imports and generating idiomatic JavaScript modules. It converts assignments to global namespace objects to module exports, and references to namespaces as imported names. 

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
import { Element } from '../../@polymer/polymer/polymer-element.js';

export const MyElement = class extends Element {
  static get template() {
    return `
    <h2>Hello Modules!</h2>
`;
  }

  static get is() { return 'my-element'; }
  // ...
}
window.customElements.define(MyElement.is, MyElement);
```

## Usage

polymer-modulizer has two modes. Given no default arguments, it converts the current directory as a package. Given one or more GitHub repository names, it creates a workspace and converts those repositories and their dependencies at once.

### Workspace mode

You must first generate a GitHub access token and store it in a file named `github-token`.

Then run:

```sh
modulizer owner/repo owner2/repo2
```

The will create a `modulizer_workspace` directory and checkout the repos and their Bower dependencies and convert them all in place. You can then run `polymer serve` in the workspace directory and try out the results in Chrome 61 or Safari 10.1 (or Edge and Firefox with the appropriate flags turned on).

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

## Status

polymer-modulizer is under heavy construction, but can already convert Polymer core and many elements. Demos often work, though sometimes with a few manual fixes. Work is continuing on getting tests to run and pass automatically, and in generating more idiomatic JavaScript modules.

Please file any issues you have with conversions.

## Breaking changes

Converting HTML to modules involves a few breaking changes. See [./docs/breaking_changes.md](./docs/breaking_changes.md).

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
