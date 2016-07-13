/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

"use strict";

// jshint node:true
const assert = require('chai').assert;
const path = require('path');

const FileLoader = require('../src/loader/file-loader.js').FileLoader;
const FSResolver = require('../src/loader/fs-resolver.js').FSResolver;
const NoopResolver = require('../src/loader/noop-resolver.js').NoopResolver;
const RedirectResolver = require('../src/loader/redirect-resolver.js').RedirectResolver;

suite('Loader', function() {
  let loader;

  setup(function() {
    loader = new FileLoader();
  });

  test('api', function() {
    assert.ok(loader.addResolver);
    assert.ok(loader.request);
    assert.ok(loader.requests);
  });

  test('request returns a promise', function() {
    if (!global.Promise) {
      return;
    }
    var p = loader.request('/');
    assert.instanceOf(p, Promise);
  });

  test('request promises are deduplicated', function() {
    var p = loader.request('/');
    var p2 = loader.request('/');
    assert.equal(p, p2);
    assert.equal(Object.keys(loader.requests).length, 1);
  });

  test('Null Resolver', function(done) {
    loader.request('/').then(function() {
      throw 'should not get here';
    }, function(err) {
      assert.include(err.message, 'no resolver found');
      done();
    });
  });

  suite('redirect resolver', function(){

    test('redirects to the fs', function(done) {
      var redirect = new RedirectResolver.ProtocolRedirect({
        protocol: 'chrome:',
        hostname: 'settings',
        path: '/static/',
        redirectPath: 'test/static'
      });
      var resolver = new RedirectResolver({
        root: path.join(__dirname, '..'),
        redirects: [redirect]
      });
      loader.addResolver(resolver);
      loader.request('chrome://settings/static/xhr-text.txt').then(function(content){
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });
  });

  suite('Filesystem Resolver', function() {

    test('fs api', function() {
      var fs = new FSResolver({});
      assert.ok(fs.accept);
    });

    test('absolute url', function(done) {
      var fs = new FSResolver({
        root: path.join(__dirname, '..')
      });
      loader.addResolver(fs);
      loader.request('/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('host', function(done) {
      var fs = new FSResolver({
        host: 'www.example.com',
        root: path.join(__dirname, '..')
      });
      loader.addResolver(fs);
      loader.request('http://www.example.com/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('basepath', function(done) {
      var fs = new FSResolver({
        host: 'www.example.com',
        basePath: '/components'
      });

      loader.addResolver(fs);
      loader.request('http://www.example.com/components/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('root', function(done) {
      var fs = new FSResolver({
        host: 'www.example.com',
        basePath: '/components',
        root: 'test/static/'
      });

      loader.addResolver(fs);
      loader.request('http://www.example.com/components/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });

    test('Spaces in Filepath', function(done) {
      var fs = new FSResolver({
        root: path.join(__dirname, '..')
      });
      loader.addResolver(fs);
      loader.request('/test/static/spaces%20in%20request.txt').then(function(content) {
        assert.equal(content.trim(), 'Spaces!');
      }).then(done, done);
    });

    test('Spaces in Filepath', function(done) {
      var fs = new FSResolver({
        root: path.join(__dirname, '..'),
        basePath: '/space%20in%20basePath'
      });
      loader.addResolver(fs);
      loader.request('/space%20in%20basePath/test/static/xhr-text.txt').then(function(content) {
        assert.equal(content.trim(), 'Hello!');
      }).then(done, done);
    });
  });

  suite('Noop Resolver', function() {

    test('loader api', function() {
      var noop = new NoopResolver();
      assert.ok(noop.accept);
    });

    test('accepts a string', function() {
      var noop = new NoopResolver("foo");
      var actual = noop.accept('foo', {resolve:function(){}});
      assert.isTrue(actual);
    });

    test('accepts a regex', function() {
      var noop = new NoopResolver(/./);
      var actual = noop.accept('foo', {resolve:function(){}});
      assert.isTrue(actual);
    });

    test('returns empty string for accepted urls', function(done) {
      var noop = new NoopResolver(/./);
      loader.addResolver(noop);
      loader.request('anything').then(function(content) {
        assert.equal('', content);
      }).then(done, done);
    });

  });

});
