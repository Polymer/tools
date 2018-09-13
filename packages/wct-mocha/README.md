[![NPM version](http://img.shields.io/npm/v/wct-mocha?style=flat-square)](https://npmjs.org/package/wct-mocha)
[![Build Status](http://img.shields.io/travis/Polymer/tools.svg?style=flat-square)](https://travis-ci.org/Polymer/tools)
[![Gitter](http://img.shields.io/badge/slack-join%20chat%20%E2%86%92-brightgreen.svg?style=flat-square)](https://polymer-slack.herokuapp.com/)

`wct-mocha` makes testing your web components a breeze!

You get a streamlined browser-based testing environment, designed to work with [web-component-tester](https://github.com/Polymer/tools/tree/master/packages/web-component-tester) or on its own.


# Getting Started

## Install mocha and wct-mocha as devDependencies

```bash
$ npm install --save-dev mocha
$ npm install --save-dev wct-mocha
```

## Install `web-component-tester` or `polymer-cli` globally

```bash
$ npm install --global web-component-tester
```

## Run `wct`

```bash
$ wct --wct-package-name wct-mocha
```

## `.html` Suites

Your test suites can be `.html` documents. For example,
`test/awesomest-tests.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="../node_modules/mocha/mocha.js"></script>
  <script src="../node_modules/chai/chai.js"></script>
  <script src="../node_modules/wct-mocha/browser.js"></script>
</head>
<body>
  <awesome-element id="fixture"></awesome-element>
  <script type="module">
    import {AwesomeElement} from '../src/awesome-element.js';
    suite('<awesome-element>', function() {
      test('is awesomest', function() {
        const element = document.getElementById('fixture');
        chai.assert.instanceOf(AwesomeElement);
        chai.assert.isTrue(element.awesomest);
      });
    });
  </script>
</body>
</html>
```

## `.js` Suites

Alternatively, you can write tests in separate `.js` sources. For example,
`test/awesome-tests.js`:

```js
suite('AwesomeLib', function() {
  test('is awesome', function() {
    assert.isTrue(AwesomeLib.awesome);
  });
});
```

## Special Features

### Web Server

If you prefer not to use WCT's command line tool, you can also run WCT tests
directly in a browser via a web server of your choosing.

Make sure that WCT's `browser.js` is accessible by your web server, and have
your tests load `browser.js`.

#### Nested Suites

To help support this case, you can also directly define an index that will load
any desired tests:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <script src="../node_modules/mocha/mocha.js"></script>
    <script src="../node_modules/wct-mocha/browser.js"></script>
  </head>
  <body>
    <script>
      WCT.loadSuites([
        'awesome-tests.js',
        'awesomest-tests.html',
      ]);
    </script>
  </body>
</html>
```

_When you use `wct` on the command line, it is generating an index like this for
you based on the suites you ask it to load._



# Nitty Gritty

## Polymer

By default, WCT will defer tests until `WebComponentsReady` has fired. This
saves you from having to wait for elements to upgrade and all that yourself.

If you need to test something that occurs before that event, the [`testImmediate` helper](https://github.com/Polymer/web-component-tester/blob/master/browser/environment/helpers.js#L29-41) can be used. Or, if you just want tests to run as soon as possible, you can disable the delay by setting `WCT.waitForFrameworks = false` (though, they are still async due to Mocha).


## Mocha

WCT supports Mocha's [TDD][mocha-tdd] (`suite`/`test`/etc) and [BDD][mocha-bdd]
(`describe`/`it`/etc) interfaces, and will call `mocha.setup`/`mocha.run` for
you. Just write your tests, and you're set.


## Custom Environments

If you would like to have WCT load libraries on your behalf, you can define a
list of scripts loaded. There are two ways of doing this:

Inside your test code (before `wct-mocha/browser.js` is loaded):
```html
<script>
  WCT = {
    environmentScripts: [
      '../node_modules/mocha/mocha.js',
      '../node_modules/chai/chai.js',
      '../node_modules/@polymer/test-fixture/test-fixture.js'
      // Include anything else that you like!
    ]
  };
```

Alternatively, `web-component-tester` can pass the entire value of the WCT block
object here straight from the `clientOptions` key in `wct.conf.json`.

A reference of the default configuration can be found at
[browser/config.ts](browser/config.ts).


<!-- References -->
[mocha]:      http://mochajs.org/                   "Mocha Test Framework"
[mocha-bdd]:  http://mochajs.org/#bdd-interface     "Mocha's BDD Interface"
[mocha-tdd]:  http://mochajs.org/#tdd-interface     "Mocha's TDD Interface"
[test-fixture]: https://github.com/PolymerElements/test-fixture "Easy DOM fixture testing"
