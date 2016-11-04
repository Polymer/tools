# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

# Unreleased

* We're standardizing on the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) so that we can support a larger number of editors with less code that is specific to Polymer and our editor service. Open protocols FTW!
  * Our old homegrown protocol, used by the atom and sublime text plugins is deprecated. We'll be updating those plugins to use the LSP in upcoming releases. ETA end of November 2016.

* Greatly improve contextual autocompletion. The context determiner now understands comments, inline script and style elements, and template contents. We also now correctly handle a vast number of edge cases. [commit](https://github.com/Polymer/polymer-analyzer/commit/3ff3196d6f1b6a0ab8598a8f4aeeaa5328fa755b). [pull request](https://github.com/Polymer/polymer-analyzer/pull/348)

* Prototyped initially with [vscode](https://github.com/Polymer/vscode-plugin), followed by [atom](https://github.com/Polymer/atom-plugin) and then [https://github.com/Polymer/polymer-sublime-plugin](sublime).

* Added support for getting documentation for feature at position, getting a list of Warnings for a filename, getting the definition for a feature at a position, and getting typeahead completions for a file at a position.
