# polymer-editor-service

Static analysis for web components in your text editor of choice!

## Editor plugins

These editor plugins use the editor service:

 * https://github.com/Polymer/atom-plugin
 * https://github.com/Polymer/vscode-plugin
 * https://github.com/Polymer/polymer-sublime-plugin

## More Information

The Editor Service exposes the power of [the analyzer](https://github.com/Polymer/polymer-analyzer) as a standalone service for text editor integration.

### Protocol

The `polymer-language-service` command speaks the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) over stdin and stdout.

`polymer-editor-server` and its nonstandard protocol are deprecated, and we'll be migrating the atom and sublime text plugins over to use the `polymer-language-service` soon. The differences are fairly minor and migration should be done by the end of November 2016.
