/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// jshint node:true
var assert = require('chai').assert;

suite('Loader', function() {
  var loader = require('../lib/file-loader.js');
  var l;

  beforeEach(function() {
    l = new loader();
  });

  test('api', function() {
    assert.ok(l.addResolver);
    assert.ok(l.request);
    assert.ok(l.requests);
  });

  test('request returns a promise', function() {
    if (!global.Promise) {
      return;
    }
    var p = l.request('/');
    assert.instanceOf(p, Promise);
  });

  test('request promises are deduplicated', function() {
    var p = l.request('/');
    var p2 = l.request('/');
    assert.equal(p, p2);
    assert.equal(l.requests.size, 1);
  });

  test('Null Resolver', function(done) {
    l.request('/').then(function() {
      throw 'should not get here';
    }, function(err) {
      assert.equal(err, 'no resolver found');
      done();
    });
  });

  suite('Filesystem Resolver', function() {
    var fsResolver = require('../lib/fs-resolver.js');

    test('fs api', function() {
      var fs = new fsResolver({});
      assert.ok(fs.accept);
    });

    test('absolute url', function(done) {
      var fs = new fsResolver({});
      l.addResolver(fs);
      l.request('/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('host', function(done) {
      var fs = new fsResolver({
        host: 'www.example.com'
      });
      l.addResolver(fs);
      l.request('http://www.example.com/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('basepath', function(done) {
      var fs = new fsResolver({
        host: 'www.example.com',
        basePath: '/components'
      });

      l.addResolver(fs);
      l.request('http://www.example.com/components/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('root', function(done) {
      var fs = new fsResolver({
        host: 'www.example.com',
        basePath: '/components',
        root: 'test/static/'
      });

      l.addResolver(fs);
      l.request('http://www.example.com/components/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });
  });

  suite('URL Resolver', function() {
    var urlResolver = require('../lib/url-resolver.js');

    beforeEach(function() {
      var url = new urlResolver({
        host: 'www.polymer-project.org'
      });
      l.addResolver(url);
    });

    test('api', function() {
      var url = new urlResolver();
      assert.ok(url.accept);
    });

    test('absolute url', function(done) {
      l.request('http://www.polymer-project.org/index.html').then(function(content) {
        assert.ok(content);
      }).then(done, done);
    });

    test('https absolute url', function(done) {
      l.request('https://www.polymer-project.org/index.html').then(function(content) {
        assert.ok(content);
      }).then(done, done);
    });

    test('wrong host', function(done) {
      l.request('http://www.example.com/index.html').then(function(){
        throw 'should not get here';
      }, function(err) {
        assert.equal(err, 'no resolver found');
      }).then(done, done);
    });

  });
});
