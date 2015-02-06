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


  var modules, elements, currentModule, currentElement;

  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate") {
          module = {};
          // modulate('module-name', {});
          module.is = node.arguments[0].value;
          var comments = parent.leadingComments;
          if (comments && comments.length > 0) {
            module.desc = comments[comments.length-1].value;
          }
          currentModule = module;
          console.log(module);
        }
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate") {
          if (currentModule) {
            modules.push(currentModule);
            currentModule = undefined;
          }
        }
      }
    }
  };

  var visitor;
  // ESTraverse visitor
  var traverse = {
    enter: function(node, parent) {
      visitor = "enter" + node.type;
      if (visitor in visitors) {
        visitors[visitor](node, parent);
      }
    },
    leave: function(node, parent) {
      visitor = "leave" + node.type;
      if (visitor in visitors) {
        visitors[visitor](node, parent);
      }
    }
  }

  var jsParse = function jsParse(jsString){
    var script = esprima.parse(jsString, {attachComment: true, comment: true, loc: true});
    modules = [];
    elements = [];
    estraverse.traverse(script, traverse);
    return {modules: modules, elements: elements};
  };

  context.exports = jsParse;
}(module));