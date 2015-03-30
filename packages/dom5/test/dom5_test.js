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
var dom5 = require('../dom5');

var assert = chai.assert;

suite('dom5', function() {

  suite('Parse5 Wrapper Functions', function() {
    var parse5 = require('parse5');
    var docText = "<!DOCTYPE html><div id='A' qux>a1<div bar='b1' bar='b2'>b1</div>a2</div><!-- comment -->";
    var fragText = '<template><span>Foo</span></template><!-- comment --><my-bar></my-bar>';
    var parser = new parse5.Parser();

    test('parse', function() {
      var doc_expected = parser.parse(docText);
      var doc_actual = dom5.parse(docText);

      assert.deepEqual(doc_expected, doc_actual);
    });

    test('parseFragment', function() {
      var frag_expected = parser.parseFragment(fragText);
      var frag_actual = dom5.parseFragment(fragText);

      assert.deepEqual(frag_expected, frag_actual);
    });

    test('serialize', function() {
      var serializer = new parse5.Serializer();

      var ast = parser.parse(docText);
      var expected = serializer.serialize(ast);
      var actual = dom5.serialize(ast);

      assert.equal(expected, actual);

      ast = parser.parseFragment(fragText);
      expected = serializer.serialize(ast);
      actual = dom5.serialize(ast);

      assert.equal(expected, actual);
    });

  });

  suite('Parse5 Node Manipulation', function() {

    var docText = "<!DOCTYPE html><div id='A' qux>a1<div bar='b1' bar='b2'>b1</div>a2</div><!-- comment -->";
    var doc = null;

    setup(function () {
      doc = dom5.parse(docText);
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

    suite('getTextContent', function() {
      var body;

      suiteSetup(function() {
        body = doc.childNodes[1].childNodes[1];
      });

      test('text node', function() {
        var node = body.childNodes[0].childNodes[0];
        var expected = 'a1';
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
      });

      test('comment node', function() {
        var node = body.childNodes.slice(-1)[0];
        var expected = ' comment ';
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
      });

      test('leaf element', function() {
        var node = body.childNodes[0].childNodes[1];
        var expected = 'b1';
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
      });

      test('recursive element', function() {
        var expected = 'a1b1a2';
        var actual = dom5.getTextContent(body);
        assert.equal(actual, expected);
      });
    });

    suite('setTextContent', function() {
      var body;
      var expected = 'test';

      suiteSetup(function() {
        body = doc.childNodes[1].childNodes[1];
      });

      test('text node', function() {
        var node = body.childNodes[0].childNodes[0];
        dom5.setTextContent(node, expected);
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
      });

      test('comment node', function() {
        var node = body.childNodes.slice(-1)[0];
        dom5.setTextContent(node, expected);
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
      });

      test('leaf element', function() {
        var node = body.childNodes[0].childNodes[1];
        dom5.setTextContent(node, expected);
        var actual = dom5.getTextContent(node);
        assert.equal(actual, expected);
        assert.equal(node.childNodes.length, 1);
      });

      test('recursive element', function() {
        dom5.setTextContent(body, expected);
        var actual = dom5.getTextContent(body);
        assert.equal(actual, expected);
        assert.equal(body.childNodes.length, 1);
      });
    });

    suite('Remove node', function() {
      test('node is removed from parentNode', function() {
        var divA = doc.childNodes[1].childNodes[1].childNodes[0];
        var parent = divA.parentNode;
        dom5.remove(divA);
        assert.equal(divA.parentNode, null);
        assert.equal(parent.childNodes.indexOf(divA), -1);
      });

      test('removed nodes do not throw', function() {
        var divA = doc.childNodes[1].childNodes[1].childNodes[0];
        dom5.remove(divA);
        dom5.remove(divA);
        assert.equal(divA.parentNode, null);
      });
    });

    suite('Append Node', function() {
      var dom, div, span;

      setup(function() {
        dom = dom5.parseFragment('<div>a</div><span></span>b');
        div = dom.childNodes[0];
        span = dom.childNodes[1];
      });

      test('node is only in one parent', function() {
        var b = dom.childNodes.slice(-1)[0];
        dom5.append(span, b);
        assert.equal(b.parentNode, span);
        assert.equal(dom.childNodes.indexOf(b), -1);
      });

      test('node is appended to the end of childNodes', function() {
        var bidx = dom.childNodes.length - 1;
        var b = dom.childNodes[bidx];
        dom5.append(div, b);
        bidx = div.childNodes.length - 1;
        assert.equal(div.childNodes[bidx], b);
      });

      test('a node that is appended to its current parent is reordered', function() {
        var bidx = dom.childNodes.length - 1;
        var b = dom.childNodes[bidx];
        var a = div.childNodes[0];
        dom5.append(div, b);
        dom5.append(div, a);
        assert.equal(div.childNodes[0], b);
        assert.equal(div.childNodes[1], a);
      });
    });

    suite('InsertBefore', function() {
      var dom, div, span, a;

      setup(function() {
        dom = dom5.parseFragment('<div></div><span></span>a');
        div = dom.childNodes[0];
        span = dom.childNodes[1];
        a = dom.childNodes[2];
      });

      test('ordering is correct', function() {
        dom5.insertBefore(dom, span, a);
        assert.equal(dom.childNodes.indexOf(a), 1);
        dom5.insertBefore(dom, div, a);
        assert.equal(dom.childNodes.indexOf(a), 0);
      });
    });
  });

  suite('Query Predicates', function() {
    var fragText = '<div id="a" class="b c"><!-- nametag -->Hello World</div>';
    var frag = null;
    suiteSetup(function() {
      frag = dom5.parseFragment(fragText).childNodes[0];
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
      doc = dom5.parse(docText);
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
      var serializedDoc = dom5.serialize(doc);
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

  suite('Text Normalization', function() {
    var con = dom5.constructors;

    test('normalizing text nodes or comment nodes is a noop', function() {
      var tn = con.text('test');
      var cn = con.comment('test2');

      dom5.normalize(tn);
      dom5.normalize(cn);
      assert.equal(tn, tn);
      assert.equal(cn, cn);
    });

    test("an element's child text nodes are merged", function() {
      var div = con.element('div');
      var tn1 = con.text('foo');
      var tn2 = con.text('bar');
      dom5.append(div, tn1);
      dom5.append(div, tn2);

      var expected = dom5.getTextContent(div);
      assert.equal(expected, 'foobar');
      dom5.normalize(div);
      var actual = dom5.getTextContent(div);

      assert.equal(actual, expected);
      assert.equal(div.childNodes.length, 1);
    });

    test('only text node ranges are merged', function() {
      var div = con.element('div');
      var tn1 = con.text('foo');
      var tn2 = con.text('bar');
      var cn = con.comment('combobreaker');
      var tn3 = con.text('quux');
      dom5.append(div, tn1);
      dom5.append(div, tn2);
      dom5.append(div, cn);
      dom5.append(div, tn3);

      var expected = dom5.getTextContent(div);
      assert.equal(expected, 'foobarquux');
      dom5.normalize(div);
      var actual = dom5.getTextContent(div);

      assert.equal(actual, expected);
      assert.equal(div.childNodes.length, 3);
      assert.equal(dom5.getTextContent(div.childNodes[0]), 'foobar');
      assert.equal(dom5.getTextContent(div.childNodes[1]), 'combobreaker');
      assert.equal(dom5.getTextContent(div.childNodes[2]), 'quux');
    });

    test('empty text nodes are removed', function() {
      var div = con.element('div');
      var tn = con.text('');
      dom5.append(div, tn);

      assert.equal(div.childNodes.length, 1);
      dom5.normalize(div);
      assert.equal(div.childNodes.length, 0);
    });

    test('elements are recursively normalized', function() {
      var div = con.element('div');
      var tn1 = con.text('foo');
      var space = con.text('');
      dom5.append(div, tn1);
      dom5.append(div, space);
      var span = con.element('span');
      var tn2 = con.text('bar');
      var tn3 = con.text('baz');
      dom5.append(span, tn2);
      dom5.append(span, tn3);
      dom5.append(div, span);

      assert.equal(dom5.getTextContent(div), 'foobarbaz');

      dom5.normalize(div);

      assert.equal(div.childNodes.length, 2);
      assert.equal(span.childNodes.length, 1);
    });

    test('document can be normalized', function() {
      var doc = dom5.parse('<!DOCTYPE html>');
      var body = doc.childNodes[1].childNodes[1];
      var div = con.element('div');
      var tn1 = con.text('foo');
      var space = con.text('');
      dom5.append(div, tn1);
      dom5.append(div, space);
      var span = con.element('span');
      var tn2 = con.text('bar');
      var tn3 = con.text('baz');
      dom5.append(span, tn2);
      dom5.append(span, tn3);
      dom5.append(div, span);
      dom5.append(body, div);

      assert.equal(dom5.getTextContent(doc), 'foobarbaz');
      dom5.normalize(doc);
      assert.equal(dom5.getTextContent(doc), 'foobarbaz');

      assert.equal(div.childNodes.length, 2);
      assert.equal(span.childNodes.length, 1);
    });
  });

});
