/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// jshint node: true
'use strict';
var estraverse = require('estraverse');
var findAlias = require('./find-alias');

var modulateFinder = function modulateFinder(attachAST) {
  /**
   * The list of modules exported by each traversed script.
   */
  var modules = [];

  /**
   * The module being built during a traversal;
   */
  var module;

  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier' &&
          // TODO(ajo): Get rid of legacy module systems.
          (callee.name == 'modulate' || callee.name == 'module')) {
        module = {};
        // modulate('module-name', function(){});
        module.is = node.arguments[0].value;
        if (attachAST) {
          module.ast = node;
        }

        var deps = [];
        // modulate('module-name', ['dep1', 'dep2'], function(){})
        if (node.arguments.length > 2) {
          var args = node.arguments[1].elements || [];
          var strippedArgs = args.map(function(a) { return a.value; });
          deps = deps.concat(strippedArgs);
          module.deps = deps;
        }
        var comments = parent.leadingComments;
        if (comments && comments.length > 0) {
          module.desc = comments[comments.length - 1].value;
        }
      } else if (module && callee.type == 'MemberExpression') {
        var baseCandidate = findAlias(module.depAliases,
                                      module.deps,
                                      callee.object.name);
        if (baseCandidate == 'Base' &&
            callee.property.type == 'Identifier' &&
            callee.property.name == 'extend') {
          var parentModule = findAlias(module.depAliases,
                                       module.deps,
                                       node.arguments[1].name);
          if (parentModule) {
            module.extends = parentModule;
          }
        }
      } else {
  //      console.log(node);
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier') {
        if (callee.name == 'modulate') {
          if (module) {
            modules.push(module);
            module = undefined;
          }
        }
      }
    },
    enterFunctionExpression: function enterFunctionExpression(node, parent) {
      // Check to see if we're in a module with uninitialized args;
      if (module &&
          module.deps &&
          module.deps.length > 0 &&
          !module.depAliases) {
        if (node.params.length !== module.deps.length) {
          throw {
            message: 'Function has {0} params. Expected {1}.'.format(
              node.params.length, module.deps.length),
            location: node.loc.start
          };
        }
        module.depAliases = [];
        for (var i = 0; i < node.params.length; i++) {
          var param = node.params[i];
          module.depAliases.push(param.name);
        }
      }
    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (module && !module.properties) {
        module.properties = [];
        for (var i = 0; i < node.properties.length; i++) {
          var property = {};
          var prop = node.properties[i];
          if (prop.key.type == 'Identifier') {
            property.name = prop.key.name;
          } else if (prop.key.type == 'Literal') {
            property.name = prop.key.value;
          }
          if (prop.value.type == 'FunctionExpression') {
            property.type = 'function';
          }
          var comments = prop.leadingComments;
          if (comments && comments.length > 0) {
            property.desc = comments[comments.length - 1];
          }
          module.properties.push(property);
        }
        return estraverse.VisitorOption.Skip;
      }
    }
  };
  return {visitors: visitors, modules: modules};
};

module.exports = modulateFinder;
