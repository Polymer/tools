var chai = require('chai');
var Parse5 = require('parse5');
var parse5_utils = require('../parse5-utils');

var assert = chai.assert;
var parser = new Parse5.Parser();

suite('parse5_utils', function() {

  var docText = "<!DOCTYPE html><div id='A'>a1<div bar='b1' bar='b2'>b1</div>a2</div>";
  var doc = null;

  setup(function () {
    doc = parser.parse(docText);
  });

  suite('getAttribute', function() {

    test('returns null for a non-set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(parse5_utils.getAttribute(divA, 'foo'), null);
    });

    test('returns the value for a set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(parse5_utils.getAttribute(divA, 'id'), 'A');
    });

    test('returns the first value for a doubly set attribute', function() {
      var divB = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[1];
      assert.equal(parse5_utils.getAttribute(divB, 'bar'), 'b1');
    });

    test('throws when called on a text node', function() {
      var text = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert.throws(function () {
        parse5_utils.getAttribute(text, 'bar');
      });
    });

  });

  suite('setAttribute', function() {

    test('sets a non-set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      parse5_utils.setAttribute(divA, 'foo', 'bar');
      assert.equal(parse5_utils.getAttribute(divA, 'foo'), 'bar');
    });

    test('sets and already set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      parse5_utils.setAttribute(divA, 'id', 'qux');
      assert.equal(parse5_utils.getAttribute(divA, 'id'), 'qux');
    });

    test('sets the first value for a doubly set attribute', function() {
      var divB = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[1];
      parse5_utils.setAttribute(divB, 'bar', 'baz');
      assert.equal(parse5_utils.getAttribute(divB, 'bar'), 'baz');
    });

    test('throws when called on a text node', function() {
      var text = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert.throws(function () {
        parse5_utils.setAttribute(text, 'bar', 'baz');
      });
    });

  });

});
