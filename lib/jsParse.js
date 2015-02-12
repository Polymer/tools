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
  "use strict"
  var esprima = require('esprima');
  var estraverse = require('estraverse');

  var modulateFinder = require('./modulateFinder');

  function traverse(visitors) {
    var visitor;
    return {
      enter: function(node, parent) {
        visitor = "enter" + node.type;
        //console.log(visitor);
        if (visitor in visitors) {
          return visitors[visitor](node, parent);
        }
      },
      leave: function(node, parent) {
        visitor = "leave" + node.type;
        //console.log(visitor);
        if (visitor in visitors) {
          return visitors[visitor](node, parent);
        }
      }
    }
  }

  var jsParse = function jsParse(jsString){
    var script = esprima.parse(jsString, {attachComment: true, comment: true, loc: true});
    var moduleFinder = modulateFinder();
    var v = moduleFinder.visitors;
    estraverse.traverse(script, traverse(v));
    return {modules: moduleFinder.modules, elements: []};
  };

  context.exports = jsParse;
}(module));