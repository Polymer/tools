[![Build Status](https://travis-ci.org/Polymer/polymer-linter.svg?branch=master)](https://travis-ci.org/Polymer/polymer-linter)
[![NPM version](http://img.shields.io/npm/v/polymer-linter.svg)](https://www.npmjs.com/package/polymer-linter)

# Polymer Linter

A library for finding and reporting on suspicious patterns and errors in web projects.

## Usage

The Polymer Linter can be run from command line with the [Polymer CLI](https://github.com/Polymer/polymer-cli), or though IDE plugins, such as the [VS Code Plugin](https://github.com/Polymer/vscode-plugin).

First though, it needs to be configured. Create a `polymer.json` file at the root of your project and ensure it has a "lint" field like so:

```json
{
  "lint": {
    "rules": ["polymer-2-hybrid"]
  }
}
```

You can specify either individual rules, or rule collections. See `polymer lint --help` for a full listing.

### From the command line

polymer-lint is run on the command line through Polymer CLI:

```
  npm install -g polymer-cli
  cd my-project
  polymer lint
```

By default this produces output with the exact location of any issues clearly underlined:

```
    <paper-button opan="{{nonono}}"></paper-button>
                  ~~~~

my-elem.html(9,24) warning [set-unknown-attribute] - paper-button elements do not have a property named opan. Consider instead:  open
```

### Inside your editor

polymer-lint is also integrated into a number of editor plugins for instant as-you-type linting. See [the polymer editor service](https://github.com/Polymer/polymer-editor-service) for details.

![Animated gif of the VSCode with the linter running.](https://cloud.githubusercontent.com/assets/1659/23933285/ad63eb62-08fa-11e7-819b-641bf83cf9c6.gif)

### Use with other tools

The linter checks specifically for potential issues in custom elements and Polymer. It's best paired with other more general purpose linters such as [eslint](https://eslint.org/) and [htmlint](https://github.com/htmllint/htmllint).

## Extending and contributing

The linter is built on top of the [polymer analyzer](https://github.com/Polymer/polymer-analyzer). A lint rule is given a `Document` object with an AST that can be walked, as well as the ability to query high level features of the document like imports and custom elements. From this is just has to return an array of warnings to display.

For a simple example, see [behaviors-spelling](src/polymer/behaviors-spelling.ts), which implements a check for the commonwealth spelling of the property `behaviors` on a Polymer element.

In the future we will support loading lint rules dynamically through a plugin system, but initially all lint rules live in this repo. You'll want to import your rule from [rules.ts](src/rules.ts), and you probably want to add your rule to one or more [rule collections](src/collections.ts).

### Testing

Run tests with `npm test`. Test code goes in `src/test` and fixtures go in `test/`. Each lint rule should test that it is registered correctly, and that it causes neither false positives nor false negatives.

See [behaviors-spelling_test.ts](src/test/polymer/behaviors-spelling_test.ts) for an example.

We also have an integration test that runs the `polymer-2-hybrid` rule collection over all of PolymerElements. Run it with `npm run test:integration`. It's an excellent way to test for false positives.

### New Lint Rules Welcome!

More lint rules are very much welcome! We're happy to answer questions. We've got a very welcoming community, come join us in the [#tools channel on slack](https://polymer.slack.com/messages/tools)! ([invites emailed automatically here](https://polymer-slack.herokuapp.com/))

## Looking for Polylint?

Polymer Linter is the successor to [polylint](https://www.github.com/polymerlabs/polylint).

