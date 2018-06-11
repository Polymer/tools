## Sublime Text

Sublime Text is supported via the [LSP package](https://github.com/tomv564/LSP).

#### Prerequisites

1. Sublime Text 3.0 or greater
2. NodeJS v6 or greater

#### Install `polymer-editor-service`:

```
$ npm install -g polymer-editor-service
```

#### Install the LSP Package

In sublime text, press Ctrl-Shift-P (Cmd-Shift-P on Mac) and select `Package Control: Install Package`.

Then, select the `LSP` package.

#### Configure LSP

In sublime text, press Ctrl-Shift-P (Cmd-Shift-P on Mac) and select `Preferences: LSP Settings`

Add a polymer-ide entry to the clients section like so. This is a complete example of what your LSP Settings might look like. You'll have to fill in the command with the path to the polymer-editor-service binary on your system:

```json
{
  "clients": {
    "polymer-ide": {
      "command": [
        "polymer-editor-service"
      ],
      "scopes": [
        "text.html.basic",
        "text.html",
        "source.html",
        "source.js",
        "source.css"
      ],
      "syntaxes": [
        "Packages/HTML/HTML.sublime-syntax",
        "Packages/CSS/CSS.sublime-syntax",
        "Packages/JavaScript/JavaScript.sublime-syntax",
        "Packages/JavaScript/JSON.sublime-syntax"
      ],
      "languageId": "polymer",
      "settings": {
        "polymer-ide": {
          "analyzeWholePackage": true,
          "fixOnSave": false
        }
      }
    }
  }
}
```

#### Restart Sublime Text

Open a polymer project directory in sublime. Add a typo an HTML Import, and you should get a diagnostic describing the error.


#### Don't forget to keep polymer-editor-service up to date!

Run `npm install -g polymer-editor-service` periodically to get the latest features!
