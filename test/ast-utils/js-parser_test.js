"use strict";

const path = require('path');
const assert = require('chai').assert;

const docs = require('../../lib/ast-utils/docs');
const jsParse = require('../../lib/ast-utils/js-parse').jsParse;
const FSUrlLoader = require('../../lib/url-loader/fs-url-loader').FSUrlLoader;

suite('js-parser', () => {

  let loader;

  suiteSetup(() => {
    loader = new FSUrlLoader(path.resolve(__dirname, '../'));
  });

  suite('ES6 support', () => {

    test('parses classes', () => {
      return loader.load("static/es6-support.js")
        .then(function(content) {
          var parsed = jsParse(content);
          assert.equal(parsed.elements.length, 2);
          assert.equal(parsed.elements[0].behaviors.length, 2);
          assert.equal(parsed.elements[0].behaviors[0], 'Behavior1');
          assert.equal(parsed.elements[0].behaviors[1], 'Behavior2');
          assert.equal(parsed.elements[0].is, 'test-seed');
          assert.equal(parsed.elements[0].observers.length, 2);
          assert.equal(parsed.elements[0].properties.length, 4);
          assert.equal(parsed.elements[0].events.length, 1);
        });
    });

    test('parses 1 classe', () => {
      return loader.load("static/es6-support-simple.js")
        .then(function(content) {
          var parsed = jsParse(content);
          assert.equal(parsed.elements.length, 1);
          assert.equal(parsed.elements[0].behaviors.length, 2);
          assert.equal(parsed.elements[0].behaviors[0], 'Behavior1');
          assert.equal(parsed.elements[0].behaviors[1], 'Behavior2');
          assert.equal(parsed.elements[0].is, 'test-seed');
          assert.equal(parsed.elements[0].observers.length, 2);
          assert.equal(parsed.elements[0].properties.length, 4);
          assert.equal(parsed.elements[0].events.length, 1);
        });
    });
  });

  suite('parser throws errors', () => {
    /*
     * Two js documents, one with an error and one with a module
     * declaration.
     */
    var parseError;
    setup(() => {
      return loader.load("static/js-parse-error.js").then((content) => {
        parseError = content;
      });
    });

    test('js syntax error', () => {
      try {
        jsParse(parseError);
      } catch (err) {
        assert.equal(err.lineNumber, 17);
        return;
      }
      assert.fail();
    });
  });

  suite('Polymer.Base._addFeature', () => {

    var parsed;

    suiteSetup(() => {
      return loader.load("static/js-polymer-features.js").then((content) => {
        parsed = jsParse(content);
      });
    });

    test('finds calls to Polymer.Base._addFeature, in order', () => {
      assert.equal(parsed.features.length, 2);
      assert.equal(parsed.features[0].properties.length, 6);
      assert.equal(parsed.features[1].properties.length, 1);
    });

    test('detects property types, in Closure notation', () => {
      var properties = parsed.features[0].properties;
      assert.equal(properties[0].type, 'number');
      assert.equal(properties[1].type, 'boolean');
      assert.equal(properties[2].type, 'string');
      assert.equal(properties[3].type, 'Array');
      assert.equal(properties[4].type, 'Object');
      assert.equal(properties[5].type, 'Function');
    });

    test('finds globally attached documentation', function() {
      assert.equal(parsed.features[0].desc, '* Feature one is super great! ');
    });

    test('finds docs attached to properties', function() {
      assert.equal(parsed.features[1].properties[0].desc, '* It does things! ');
    });

  });

  suite('element metadata', () => {

    var parsed;

    setup(() => {
      return loader.load("static/js-elements.js")
        .then((content) => {
          parsed = jsParse(content);
          parsed.elements.forEach(function(el) {
            docs.annotateElement(el);
          });
          parsed.behaviors.forEach(function(beh) {
            docs.annotateBehavior(beh);
          });
        });
    });

    test('Find all Polymer calls', () => {
      assert.equal(parsed.elements.length, 2);
    });

    test('Polymer elements are named', () => {
      assert.equal(parsed.elements[0].is, 'test-element');
      assert.equal(parsed.elements[1].is, 'x-firebase');
    });

    test('Extracts documentation attached via a JS comment', () => {
      assert.include(parsed.elements[0].desc, 'I am a description of test-element.');
    });

    test('Finds all published properties', () => {
      var published = 0;
      for (var i = 0; i < parsed.elements.length; i++) {
        var element = parsed.elements[i];
        if (element.is == "test-element") {

          for (var j = 0; j < element.properties.length; j++) {
            if (element.properties[j].published) {
              published++;
            }
          }
        }
      }
      assert.equal(published, 7);
    });

    test('Extracts configured property types', () => {
      var firebase = parsed.elements[1];
      for (var i = 0, prop; prop = firebase.properties[i]; i++) {
        if (prop.name !== 'keys') continue;
        assert.equal(prop.type, 'Array');
      }
    });

    test('Extracts configured events', () => {
      var firebase = parsed.elements[1];
      assert.equal(firebase.events.length, 2);
      assert.equal(firebase.events[0].name, 'data-change');
    });

    test('Finds hero tag', () => {
      var el = parsed.elements[0];
      assert.equal(el.hero, '/path/to/hero.png');
    });

    test('Finds demo tags', () => {
      var el = parsed.elements[0];
      assert.equal(el.demos.length, 3);
      assert.equal(el.demos[1].path, '/demo/index.php');
      assert.equal(el.demos[1].desc, 'I am a php demo');
    });

    test('Published properties have notify values', () => {
      var foundNotify = false;
      for (var i = 0; i < parsed.elements.length; i++) {
        var element = parsed.elements[i];
        if (element.is == "test-element") {
          var published = 0;
          for (var j = 0; j < element.properties.length; j++) {
            if (element.properties[j].name == "objectNotify") {
              foundNotify = true;
            }
          }
        }
      }
      assert(foundNotify);
    });

    test('Find all methods', () => {
      var foundMethods = false;
      for (var i = 0; i < parsed.elements.length; i++) {
        var element = parsed.elements[i];
        if (element.is == "x-firebase") {
          var methods = 0;
          for (var j = 0; j < element.properties.length; j++) {
            if (element.properties[j].type == "Function") {
              methods++;
            }
          }
          if (methods == 31) {
            foundMethods = true;
          }
        }
      }
      assert(foundMethods);
    });

    test('Extracts method properties', () => {
      var firebase = parsed.elements[1];
      for (var i = 0, prop; prop = firebase.properties[i]; i++) {
        if (prop.name !== 'observeObject') continue;
        assert.deepEqual(prop.params, [
          {name: 'added'},
          {name: 'removed'},
          {name: 'changed'},
          {name: 'getOldValueFn'},
        ]);
      }
    });

  });

  // TODO(justinfagnani): port to replacement to Analyzer.behaviors, etc.
  suite.skip('behavior metadata', () => {

    let parsed;
    let byName;
    let analyzer;

    setup(() => {
      analyzer = new hyd.Analyzer({
        urlLoader: loader,
      });
      return analyzer.analyze("static/html-behaviors.html").then((root) => {
        analyzer.annotate();
      });
    });

    test('Finds behavior object assignments', () => {
      assert.equal(analyzer.behaviors.length, 4);
    });

    test('Supports behaviors at local assignments', () => {
      assert.property(analyzer.behaviorsByName, 'SimpleBehavior');
      assert.equal(analyzer.behaviorsByName['SimpleBehavior'].properties[0].name, 'simple');
    });

    test('Supports behaviors with renamed paths', () => {
      assert.property(analyzer.behaviorsByName, 'AwesomeBehavior');
      var found = false;
      analyzer.behaviorsByName['AwesomeBehavior'].properties.forEach(function(prop) {
        if (prop.name == 'custom') {
          found = true;
        }
      });
      assert(found);
    });

    test('Supports behaviors On.Property.Paths', () => {
      assert.property(analyzer.behaviorsByName, 'Really.Really.Deep.Behavior');
      assert.equal(analyzer.behaviorsByName['Really.Really.Deep.Behavior'].properties[0].name, 'deep');
    });

    test('Supports property array on behaviors', () => {
      var defaultValue;
      analyzer.behaviorsByName['AwesomeBehavior'].properties.forEach(function(prop) {
        if (prop.name == 'a') {
          defaultValue = prop.default;
        }
      });
      assert.equal(defaultValue, 1);
    });

    test('Supports chained behaviors', () => {
      assert.property(analyzer.behaviorsByName, 'CustomBehaviorList');
      assert.equal(analyzer.behaviorsByName['CustomBehaviorList'].behaviors[0], 'SimpleBehavior');
      assert.equal(analyzer.behaviorsByName['CustomBehaviorList'].behaviors[1], 'CustomNamedBehavior');
      assert.equal(analyzer.behaviorsByName['CustomBehaviorList'].behaviors[2], 'Really.Really.Deep.Behavior');
      assert.equal(analyzer.behaviorsByName['Really.Really.Deep.Behavior'].behaviors.length, 1);
      assert.equal(analyzer.behaviorsByName['Really.Really.Deep.Behavior'].behaviors[0], 'Do.Re.Mi.Fa');
    });
  });

});
