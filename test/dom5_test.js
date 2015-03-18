/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var chai = require('chai');
var Parse5 = require('parse5');
var dom5 = require('../dom5');

var assert = chai.assert;
var parser = new Parse5.Parser();

suite('dom5', function() {

  var docText = "<!DOCTYPE html><div id='A' qux>a1<div bar='b1' bar='b2'>b1</div>a2</div><!-- comment -->";
  var doc = null;

  setup(function () {
    doc = parser.parse(docText);
  });

  suite('Node Identity', function() {
    test('isElement', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert(dom5.isElement(divA));
    });

    test('isTextNode', function() {
      var textA1 = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert(dom5.isTextNode(textA1));
    });

    test('isCommentNode', function() {
      var commentEnd = doc.childNodes[1].childNodes[1].childNodes.slice(-1)[0];
      assert(dom5.isCommentNode(commentEnd));
    });
  });

  suite('getAttribute', function() {

    test('returns null for a non-set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(dom5.getAttribute(divA, 'foo'), null);
    });

    test('returns the value for a set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(dom5.getAttribute(divA, 'id'), 'A');
    });

    test('returns the first value for a doubly set attribute', function() {
      var divB = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[1];
      assert.equal(dom5.getAttribute(divB, 'bar'), 'b1');
    });

    test('throws when called on a text node', function() {
      var text = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert.throws(function () {
        dom5.getAttribute(text, 'bar');
      });
    });

  });

  suite('hasAttribute', function() {

    test('returns false for a non-set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(dom5.hasAttribute(divA, 'foo'), false);
    });

    test('returns true for a set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(dom5.hasAttribute(divA, 'id'), true);
    });

    test('returns true for a doubly set attribute', function() {
      var divB = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[1];
      assert.equal(dom5.hasAttribute(divB, 'bar'), true);
    });

    test('returns true for attribute with no value', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      assert.equal(dom5.hasAttribute(divA, 'qux'), true);
    });

    test('throws when called on a text node', function() {
      var text = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert.throws(function () {
        dom5.hasAttribute(text, 'bar');
      });
    });

  });

  suite('setAttribute', function() {

    test('sets a non-set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      dom5.setAttribute(divA, 'foo', 'bar');
      assert.equal(dom5.getAttribute(divA, 'foo'), 'bar');
    });

    test('sets and already set attribute', function() {
      var divA = doc.childNodes[1].childNodes[1].childNodes[0];
      dom5.setAttribute(divA, 'id', 'qux');
      assert.equal(dom5.getAttribute(divA, 'id'), 'qux');
    });

    test('sets the first value for a doubly set attribute', function() {
      var divB = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[1];
      dom5.setAttribute(divB, 'bar', 'baz');
      assert.equal(dom5.getAttribute(divB, 'bar'), 'baz');
    });

    test('throws when called on a text node', function() {
      var text = doc.childNodes[1].childNodes[1].childNodes[0].childNodes[0];
      assert.throws(function () {
        dom5.setAttribute(text, 'bar', 'baz');
      });
    });

    suite('removeAttribute', function() {

      test('removes a set attribute', function() {
        var divA = doc.childNodes[1].childNodes[1].childNodes[0];
        dom5.removeAttribute(divA, 'foo');
        assert.equal(dom5.getAttribute(divA, 'foo'), null);
      });

      test('does not throw when called on a node without that attribute', function() {
        var divA = doc.childNodes[1].childNodes[1].childNodes[0];
        assert.doesNotThrow(function() {
          dom5.removeAttribute(divA, 'ZZZ');
        });
      });
    });

  });

  suite('Query Predicates', function() {
    var fragText = '<div id="a" class="b c"><!-- nametag -->Hello World</div>';
    var frag = null;
    suiteSetup(function() {
      frag = parser.parseFragment(fragText).childNodes[0];
    });

    test('hasTagName', function() {
      var fn = dom5.predicates.hasTagName('div');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasTagName('a');
      assert.isFalse(fn(frag));
    });

    test('hasAttr', function() {
      var fn = dom5.predicates.hasAttr('id');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasAttr('class');
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasAttr('hidden');
      assert.isFalse(fn(frag));
    });

    test('hasAttrValue', function() {
      var fn = dom5.predicates.hasAttrValue('id', 'a');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasAttrValue('class', 'b c');
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasAttrValue('id', 'b');
      assert.isFalse(fn(frag));
      fn = dom5.predicates.hasAttrValue('name', 'b');
      assert.isFalse(fn(frag));
    });

    test('hasClass', function() {
      var fn = dom5.predicates.hasClass('b');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasClass('c');
      assert.isTrue(fn(frag));
      fn = dom5.predicates.hasClass('d');
      assert.isFalse(fn(frag));
    });

    test('hasTextValue', function() {
      var fn = dom5.predicates.hasTextValue('Hello World');
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      var textNode = frag.childNodes[1];
      assert.isTrue(fn(textNode));
      var commentNode = frag.childNodes[0];
      fn = dom5.predicates.hasTextValue(' nametag ');
      assert.isTrue(fn(commentNode));
    });

    test('AND', function() {
      var preds = [
        dom5.predicates.hasTagName('div'),
        dom5.predicates.hasAttrValue('id', 'a'),
        dom5.predicates.hasClass('b')
      ];
      var fn = dom5.predicates.AND.apply(null, preds);
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      preds.push(dom5.predicates.hasClass('d'));
      fn = dom5.predicates.AND.apply(null, preds);
      assert.isFalse(fn(frag));
    });

    test('OR', function() {
       var preds = [
        dom5.predicates.hasTagName('div'),
        dom5.predicates.hasAttr('hidden')
      ];
      var fn = dom5.predicates.OR.apply(null, preds);
      assert.isFunction(fn);
      assert.isTrue(fn(frag));
      preds.shift();
      fn = dom5.predicates.OR.apply(null, preds);
      assert.isFalse(fn(frag));
   });

   test('NOT', function() {
     var pred = dom5.predicates.hasTagName('a');
     var fn = dom5.predicates.NOT(pred);
     assert.isFunction(fn);
     assert.isTrue(fn(frag));
     assert.isFalse(pred(frag));
   });

   test('Chaining Predicates', function() {
     var fn = dom5.predicates.AND(
       dom5.predicates.hasTagName('div'),
       dom5.predicates.OR(
         dom5.predicates.hasClass('b'),
         dom5.predicates.hasClass('d')
       ),
       dom5.predicates.NOT(
         dom5.predicates.hasAttr('hidden')
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
      '<a href="next-page.html">Anchor</a>',
      'sample element',
      '<!-- comment node -->',
      '</template>',
      '</dom-module>',
      '<script>Polymer({is: "my-el"})</script>'
    ].join('\n');
    var doc = null;

    setup(function() {
      doc = parser.parse(docText);
    });

    test('nodeWalk', function() {
      // doc -> body -> dom-module -> template -> template.content
      var templateContent = doc.childNodes[1].childNodes[1].childNodes[0]
      .childNodes[1].childNodes[0];

      var textNode = dom5.predicates.AND(
        dom5.isTextNode,
        dom5.predicates.hasTextValue('\nsample element\n')
      );

      // 'sample element' text node
      var expected = templateContent.childNodes[4];
      var actual = dom5.nodeWalk(doc, textNode);
      assert.equal(expected, actual);

      // <!-- comment node -->
      expected = templateContent.childNodes[5];
      actual = dom5.nodeWalk(templateContent, dom5.isCommentNode);
      assert.equal(expected, actual);
    });

    test('query', function() {
      var fn = dom5.predicates.AND(
        dom5.predicates.hasTagName('link'),
        dom5.predicates.hasAttrValue('rel', 'import'),
        dom5.predicates.hasAttr('href')
      );
      var expected = doc.childNodes[1].childNodes[0].childNodes[0];
      var actual = dom5.query(doc, fn);
      assert.equal(expected, actual);
    });

    test('nodeWalkAll', function() {
      var empty = dom5.predicates.AND(
        dom5.isTextNode,
        function(node) {
          return !/\S/.test(node.value);
        }
      );

      // serialize to count for inserted <head> and <body>
      var serializedDoc = (new Parse5.Serializer()).serialize(doc);
      // subtract one to get "gap" number
      var expected = serializedDoc.split('\n').length - 1;
      // add two for normalized text node "\nsample text\n"
      var actual = dom5.nodeWalkAll(doc, empty).length + 2;

      assert.equal(expected, actual);
    });

    test('queryAll', function() {
      var fn = dom5.predicates.AND(
        dom5.predicates.OR(
          dom5.predicates.hasAttr('href'),
          dom5.predicates.hasAttr('src')
        ),
        dom5.predicates.NOT(
          dom5.predicates.hasTagName('link')
        )
      );

      // doc -> body -> dom-module -> template -> template.content
      var templateContent = doc.childNodes[1].childNodes[1].childNodes[0]
      .childNodes[1].childNodes[0];

      // img
      var expected_1 = templateContent.childNodes[1];
      // anchor
      var expected_2 = templateContent.childNodes[3];
      var actual = dom5.queryAll(doc, fn);

      assert.equal(actual.length, 2);
      assert.equal(expected_1, actual[0]);
      assert.equal(expected_2, actual[1]);
    });
  });

  suite('Constructors', function() {

    test('text node', function() {
      var node = dom5.constructors.text('test');
      assert.isTrue(dom5.isTextNode(node));
      var fn = dom5.predicates.hasTextValue('test');
      assert.equal(dom5.nodeWalk(node, fn), node);
    });

    test('comment node', function() {
      var node = dom5.constructors.comment('test');
      assert.isTrue(dom5.isCommentNode(node));
      var fn = dom5.predicates.hasTextValue('test');
      assert.equal(dom5.nodeWalk(node, fn), node);
    });

    test('element', function() {
      var node = dom5.constructors.element('div');
      assert.isTrue(dom5.isElement(node));
      var fn = dom5.predicates.hasTagName('div');
      assert.equal(dom5.query(node, fn), node);
    });
  });

});
