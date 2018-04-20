[![NPM version](http://img.shields.io/npm/v/browser-capabilities.svg)](https://www.npmjs.com/package/browser-capabilities)

# browser-capabilities

A JavaScript library that detects browser capabilities from a user agent string.

The following keywords are supported. See [browser-capabilities.ts](https://github.com/Polymer/browser-capabilities/blob/master/src/browser-capabilities.ts) for the latest browser support matrix.

| Keyword       | Description
| :----         | :----
| es2015        | [ECMAScript 2015 (aka ES6)](https://developers.google.com/web/shows/ttt/series-2/es2015)
| push          | [HTTP/2 Server Push](https://developers.google.com/web/fundamentals/performance/http2/#server-push)
| serviceworker | [Service Worker API](https://developers.google.com/web/fundamentals/getting-started/primers/service-workers)
| modules       | [JavaScript Modules](https://www.chromestatus.com/feature/5365692190687232) (including dynamic `import()` and `import.meta`)

