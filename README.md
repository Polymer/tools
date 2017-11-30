# polymer-editor-service

Static analysis for web components in your text editor of choice!

## Editor plugins

These editor plugins use the editor service:

 * Atom: https://github.com/Polymer/atom-plugin
 * VSCode: https://github.com/Polymer/vscode-plugin
 * Sublime Text: https://github.com/Polymer/polymer-editor-service/wiki/Sublime-Text

## More Information

The Editor Service exposes the power of [the analyzer](https://github.com/Polymer/polymer-analyzer) as a standalone service for text editor integration.

### Supporting a new editor.

As long as the editor supports the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) (LSP), it should be easy to get it to work with the polymer editor service. When the editor service is installed via `npm` it exposes a binary named `polymer-editor-service`.

This binary speaks the LSP over stdin/stdout.

If you have an editor that supports LSP, or a plugin that adds LSP support, you can configure it to use the Editor Service. You'll typically just need to configure it with:

- The path to the `polymer-editor-service` binary.
- A list of file types that that the service supports (in this case, HTML, CSS, JavaScript and JSON files).

See the wiki page for sublime text support for an example: https://github.com/Polymer/polymer-editor-service/wiki/Sublime-Text
