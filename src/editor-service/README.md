## Editor Service

The Editor Service exposes the power of the analyzer as a standalone service for providing text editor integration.

It is intended to run out-of-process of the text editor and communicate over a JSON protocol. For editors like atom and vscode we provide a nodejs library, `remote-editor-service.js` that handles spawning and communicating with this process. For other editors we provide a nodejs binary `polymer-editor-server` that communicates over stdin and stdout.

### Demo

`polymer-editor-server` speaks newline-separated JSON objects over stdin and stdout.

    $ node lib/editor-service/polymer-editor-server.js

```json
    {"id": 0, "value": {"kind": "init", "basedir": "lib/test/static"}}

    {"id":0,"value":{"kind":"resolution"}}

    {"id": 1, "value": {"kind": "getWarningsFor", "localPath": "malformed.html"}}

    {"id":1,"value":{"kind":"resolution","resolution":[{"message":"Unexpected token <","severity":0,"code":"parse-error","sourceRange":{"file":"malformed.html","start":{"line":266,"column":0},"end":{"line":266,"column":0}}}]}}
```

### Protocol

See `src/editor-service/remote-editor-protocol.ts` for documentation on the protocol.

