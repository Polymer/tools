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

  /**
   * The list of modules exported by each traversed script.
   */
  var modules;

  /**
   * The list of elements discovered in each traversed script.
   */
  var elements;

  /**
   * The module being built during a traversal;
   */
  var module;


  /**
   * The element being built during a traversal;
   */
  var element;

  function findAlias(names, aliases, name) {
    for (var i = 0; i < names.length; i++) {
      if (names[i] == name) {
        return aliases[i];
      }
    }
    return undefined;
  }

  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate" || callee.name == "module") {
          module = {};
          // modulate('module-name', {});
          module.is = node.arguments[0].value;
          module.ast = node;

          var deps = [];
          if (node.arguments.length > 2) {
            var args = node.arguments[1].elements;
            var strippedArgs = [];
            for (var i = 0; i < args.length; i++) {
              var arg = args[i];
              strippedArgs.push(arg.value);
            }
            deps = deps.concat(strippedArgs);
            module.deps = deps;
          }
          var comments = parent.leadingComments;
          if (comments && comments.length > 0) {
            module.desc = comments[comments.length-1].value;
          }
        }
      } else if (callee.type == "MemberExpression") {
        var baseCandidate = findAlias(module.depAliases, module.deps, callee.object.name);
        if (baseCandidate == "Base")  {
          if (callee.property.type == "Identifier" && callee.property.name == "extend") {
            var parentModule = findAlias(module.depAliases, module.deps, node.arguments[1].name);
            if (parentModule) {
              module.extends = parentModule;
            }
          }
        }
      } else {
  //      console.log(node);
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate") {
          if (module) {
            modules.push(module);
            module = undefined;
          }
        }
      }
    },
    enterFunctionExpression: function enterFunctionExpression(node, parent) {
      // Check to see if we're in a module with uninitialized args;
      if (module && module.deps && module.deps.length > 0 && module.depAliases === undefined) {
        if (node.params.length !== module.deps.length) {
          throw {
            message: "Params to function expression don't match dependency list.",
            location: node.loc.start
          }
        }
        module.depAliases = [];
        for (var i = 0; i < node.params.length; i++) {
          var param = node.params[i];
          module.depAliases.push(param.name)
        }
      }
    },
    leaveFunctionExpression: function leaveFunctionExpression(node, parent) {

    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (module && module.properties === undefined) {
        module.properties = [];
        for (var i = 0; i < node.properties.length; i++) {
          var property = {};
          var prop = node.properties[i];
          if (prop.key.type == "Identifier") {
            property.name = prop.key.name;
          } else if (prop.key.type == "Literal") {
            property.name = prop.key.value;
          }
          if (prop.value.type == "FunctionExpression") {
            property.type = "function";
          }
          if (prop.leadingComments && prop.leadingComments.length > 0) {
            property.desc = prop.leadingComments[prop.leadingComments.length - 1];
          }
          module.properties.push(property);
        }
        return estraverse.VisitorOption.Skip;
      }
    }
  };

  var visitor;
  // ESTraverse visitor
  var traverse = {
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

  var jsParse = function jsParse(jsString){
    var script = esprima.parse(jsString, {attachComment: true, comment: true, loc: true});
    modules = [];
    elements = [];
    estraverse.traverse(script, traverse);
    return {modules: modules, elements: elements};
  };

  context.exports = jsParse;
}(module));