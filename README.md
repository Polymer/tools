# polymer-editor-service

Static analysis for web components in your text editor of choice!

## Editor plugins

These editor plugins use the editor service:

 * https://github.com/Polymer/atom-plugin
 * https://github.com/Polymer/vscode-plugin
 * https://github.com/Polymer/polymer-sublime-plugin

## More Information

The Editor Service exposes the power of [the analyzer](https://github.com/Polymer/polymer-analyzer) as a standalone service for text editor integration.

It is intended to run out-of-process of the text editor and communicate over a JSON protocol. For editors like atom and vscode we provide a nodejs library, `remote-editor-service.js` that handles spawning and communicating with this process. For other editors we provide a nodejs binary `polymer-editor-server` that communicates over stdin and stdout.

### Demo

`polymer-editor-server` speaks newline-separated JSON objects over stdin and stdout.

    $ node lib/polymer-editor-server.js # or just:  polymer-editor-server

```json
    {"id": 0, "value": {"kind": "init", "basedir": "lib/test/static"}}

    {"id":0,"value":{"kind":"resolution"}}

    {"id": 1, "value": {"kind": "getWarningsFor", "localPath": "malformed.html"}}

    {"id":1,"value":{"kind":"resolution","resolution":[{"message":"Unexpected token <","severity":0,"code":"parse-error","sourceRange":{"file":"malformed.html","start":{"line":266,"column":0},"end":{"line":266,"column":0}}}]}}
```

### Protocol

See `src/editor-service/remote-editor-protocol.ts` for documentation on the protocol.

