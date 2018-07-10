[![Build status](https://travis-ci.org/PolymerElements/iron-component-page.svg?branch=master)](https://travis-ci.org/PolymerElements/iron-component-page)
[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://beta.webcomponents.org/element/PolymerElements/iron-component-page)

## &lt;iron-component-page&gt;

`iron-component-page` is a full-page documentation browser for custom elements,
mixins, classes, and more. It consumes the JSON descriptor format produced by
[Polymer Analyzer](https://github.com/Polymer/polymer-analyzer).

You may also be interested in the
[`iron-doc-*`](https://github.com/PolymerElements/iron-doc-viewer) element
collection which underlies this element and can be used to embed documentation
in other apps (for example, [webcomponents.org](https://wwww.webcomponents.org)
does this).

### Documenting your element

`iron-component-page` is designed to make it easy to view documentation for
your custom element project.

1. Install the [Polymer CLI](https://github.com/Polymer/polymer-cli) with `npm
   install -g polymer-cli` or `yarn global add polymer-cli`. This gives you a
   command-line interface to Polymer Analyzer (among other things).

2. `cd` to your project directory. This can be a custom element, a full app, or
   even a plain JavaScript library. Polymer Analyzer will discover all of the
   interesting items recursively in your project directory.

3. Analyze your project with `polymer analyze > analysis.json`. This produces a
   JSON descriptor file. By default `iron-component-page` will look for a file
   called `analysis.json` (you can override this with the `descriptor-url`
   property).

4. Add `iron-component-page` as a dev dependency of your project: `bower
   install iron-component-page --save-dev`.

5. Create an HTML file to instantiate an `iron-component-page` element (e.g.
   `index.html` or `docs.html`). Note that you may need to adjust your import
   paths depending on your project layout:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0, user-scalable=yes">
  <script src="/bower_components/webcomponentsjs/webcomponents-loader.js"></script>
  <link rel="import" href="/bower_components/iron-component-page/iron-component-page.html">
</head>
<body>
  <iron-component-page></iron-component-page>
</body>
</html>
```

6. Serve that page using any local web server, such as `polymer serve` or
   `python -m SimpleHTTPServer`.

### Routing

`iron-component-page` handles URL routing (via `iron-doc-viewer`) to provide
permanent addresses for all locations in the documentation tree, including
scroll anchor targets.

By default it uses the URL fragment for routing (e.g.
`docs.html#/elements/my-element#property-foo`), in order to support simple
static file hosts.

To use the real URL path for routing, set the `base-href` property to the
server mount point (e.g. `/api/docs` or *empty string* for the root path). Note
that this requires a host that serves the application from all paths that
should be handled by the doc viewer.

### Styling

`iron-component-page` uses the default theme from
[`iron-doc-viewer`](https://github.com/PolymerElements/iron-doc-viewer). See
its documentation for styling. The following custom properties and mixins are
also available:

Custom property | Description | Default
----------------|-------------|----------
`--iron-component-page-header-color` | Background color of main header. | `paper-pink-600`

### Previous versions

The 3.x `iron-component-page` described here has major breaking changes versus
the 1.x and 2.x versions. Previous versions were based on *Hydrolysis*, the
predecessor to Polymer Analyzer. Major changes in the 3.x version include:

* Uses Polymer Analyzer descriptors instead of Hydrolysis. Among other things,
  this adds support for classes, mixins, and Polymer 2 elements.
* Does not analyze your source in the browser. Instead, run `polymer analyze`
  to generate an `analysis.json` file offline.
* Replaces the element menu with a full-size navigation panel that summarizes
  all the available documentation produced by Polymer Analyzer.
* Uses the 3.x version of the
  [`iron-doc` elements](https://github.com/PolymerElements/iron-doc-viewer).

If you still need the previous version, see the
[2.x branch](https://github.com/PolymerElements/iron-component-page/tree/2.x).
