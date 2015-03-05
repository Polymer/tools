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

  suite('Query Predicates', function() {
    var fragText = '<div id="a" class="b c"></div>';
    var frag = null;
    suiteSetup(function() {
      frag = parser.parseFragment(fragText).childNodes[0];
    });

    test('hasTagName', function() {
      var fn = parse5_utils.predicates.hasTagName('div');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasTagName('a');
      assert.isFalse(fn(frag));
    });

    test('hasAttr', function() {
      var fn = parse5_utils.predicates.hasAttr('id');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasAttr('class');
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasAttr('hidden');
      assert.isFalse(fn(frag));
    });

    test('hasAttrValue', function() {
      var fn = parse5_utils.predicates.hasAttrValue('id', 'a');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasAttrValue('class', 'b c');
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasAttrValue('id', 'b');
      assert.isFalse(fn(frag));
      fn = parse5_utils.predicates.hasAttrValue('name', 'b');
      assert.isFalse(fn(frag));
    });

    test('hasClass', function() {
      var fn = parse5_utils.predicates.hasClass('b');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasClass('c');
      assert.isTrue(fn(frag));
      fn = parse5_utils.predicates.hasClass('d');
      assert.isFalse(fn(frag));
    });

    test('AND', function() {
      var preds = [
        parse5_utils.predicates.hasTagName('div'),
        parse5_utils.predicates.hasAttrValue('id', 'a'),
        parse5_utils.predicates.hasClass('b')
      ];
      var fn = parse5_utils.predicates.AND.apply(null, preds);
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      preds.push(parse5_utils.predicates.hasClass('d'));
      fn = parse5_utils.predicates.AND.apply(null, preds);
      assert.isFalse(fn(frag));
    });

    test('OR', function() {
       var preds = [
        parse5_utils.predicates.hasTagName('div'),
        parse5_utils.predicates.hasAttr('hidden')
      ];
      var fn = parse5_utils.predicates.OR.apply(null, preds);
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      preds.shift();
      fn = parse5_utils.predicates.OR.apply(null, preds);
      assert.isFalse(fn(frag));
   });

   test('NOT', function() {
     var pred = parse5_utils.predicates.hasTagName('a');
     var fn = parse5_utils.predicates.NOT(pred);
     assert.isFunction(fn);
     assert.isTrue(fn(frag));
     assert.isFalse(pred(frag));
   });

   test('Chaining Predicates', function() {
     var fn = parse5_utils.predicates.AND(
       parse5_utils.predicates.hasTagName('div'),
       parse5_utils.predicates.OR(
         parse5_utils.predicates.hasClass('b'),
         parse5_utils.predicates.hasClass('d')
       ),
       parse5_utils.predicates.NOT(
         parse5_utils.predicates.hasAttr('hidden')
       )
     );

     assert.isFunction(fn);
     assert.isTrue(fn(frag));
   });
  });

  suite('Query', function() {
    var docText = [
      '<!DOCTYPE html>',
      '<link rel="import" href="polymer.html">',
      '<dom-module id="my-el">',
      '<template>',
      '<img src="foo.jpg">',
      '<a href="next-page.html">',
      '</template>',
      '</dom-module>',
      '<script>Polymer({is: "my-el"})</script>'
    ].join('\n');
    var doc = null;

    setup(function() {
      doc = parser.parse(docText);
    });

    test('query', function() {
      var fn = parse5_utils.predicates.AND(
        parse5_utils.predicates.hasTagName('link'),
        parse5_utils.predicates.hasAttrValue('rel', 'import'),
        parse5_utils.predicates.hasAttr('href')
      );
      var expected = doc.childNodes[1].childNodes[0].childNodes[0];
      var actual = parse5_utils.query(doc, fn);
      assert.equal(expected, actual);
    });

    test('queryAll', function() {
      var fn = parse5_utils.predicates.AND(
        parse5_utils.predicates.OR(
          parse5_utils.predicates.hasAttr('href'),
          parse5_utils.predicates.hasAttr('src')
        ),
        parse5_utils.predicates.NOT(
          parse5_utils.predicates.hasTagName('link')
        )
      );

      // doc -> body -> dom-module -> template -> template.content
      var templateContent = doc.childNodes[1].childNodes[1].childNodes[0]
      .childNodes[1].childNodes[0];

      // img
      var expected_1 = templateContent.childNodes[1];
      // anchor
      var expected_2 = templateContent.childNodes[3];
      var actual = parse5_utils.queryAll(doc, fn);

      assert.equal(actual.length, 2);
      assert.equal(expected_1, actual[0]);
      assert.equal(expected_2, actual[1]);
    });
  });

});
