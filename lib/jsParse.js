/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
* This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
* The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
* The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
* Code distributed by Google as part of the polymer project is also
* subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/**
* Finds and annotates the Polymer() and modulate() calls in javascript.
*/
(function(context){
  'use strict';
  var esprima = require('esprima');
  var estraverse = require('estraverse');

  var modulateFinder = require('./modulateFinder');
  var elementFinder = require('./elementFinder');

  function traverse(visitorRegistries) {
    var visitor, visitorFunc;
    function applyVisitors(name, node, parent) {
      var returnVal;
      for (var i = 0; i < visitorRegistries.length; i++) {
        if (name in visitorRegistries[i]) {
          returnVal = visitorRegistries[i][name](node, parent);
          if (returnVal) {
            return returnVal;
          }
        }
      }
    }
    return {
      enter: function(node, parent) {
        visitor = "enter" + node.type;
        return applyVisitors(visitor, node, parent);
      },
      leave: function(node, parent) {
        visitor = "leave" + node.type;
        return applyVisitors(visitor, node, parent);
      }
    };
  }

  var jsParse = function jsParse(jsString){
    var script = esprima.parse(jsString, {attachComment: true, comment: true, loc: true});
    var moduleFinder = modulateFinder();
    var elFinder = elementFinder();
    var moduleVisitors = moduleFinder.visitors;
    var elementVisitors = elFinder.visitors;
    estraverse.traverse(script, traverse([moduleVisitors, elementVisitors]));
    return {modules: moduleFinder.modules, elements: elFinder.elements};
  };

  context.exports = jsParse;
}(module));