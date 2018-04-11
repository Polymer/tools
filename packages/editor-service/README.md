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

There are also several ways to configure logging, which is very helpful when hooking up an editor for the first time. The simplest is to pass in `--logToFile PES.txt` when starting the editor service, but it also supports configuring logging at runtime. Logging can also be configured at runtime, see below for more info.

### Configuration options

The editor service supports the following configuration options, via the `workspace/didChangeConfiguration` notification. These configuration options should be exposed to the user through the client's configuration interface.

All options are optional, and they're within the `polymer-ide` namespace. So an example of valid params to `workspace/didChangeConfiguration` would be:

```json
{
  "settings": {
    "polymer-ide": {
      "analyzeWholePackage": true,
      "fixOnSave": true
    }
  }
}
```

#### analyzeWholePackage
> default: `false`

When true, warnings will be reported for all files in the package, not just those that are open. Not recommended for larger projects until https://github.com/Polymer/polymer-analyzer/issues/782 is resolved.

#### enableReferencesCodeLens
> default: `false`

When true, we will report the number of references at the definitions of symbols as [Code Lenses](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_codeLens). Note that this will have a performance impact similar to analyzeWholePackage.

#### fixOnSave
> default: `false`

When true, all warnings that can be safely and automatically fixed will be fixed on save.

This requires the client to support the `textDocument/synchronization/willSaveWaitUntil` and `workspace/applyEdit` capabilities.

#### logToClient
> default: `false`

When true, will send debug logs to the client via [`window/logMessage`](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#window_logMessage) notifications. The debug logs have information on performance and file synchronization, among other info.

#### logToFile
> default value: `null`

When set, will write debug logs to the file at this path. The debug logs have information on performance and file synchronization, among other info.
