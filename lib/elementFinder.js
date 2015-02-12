(function(context){
"use strict";
var estraverse = require('estraverse');
var findAlias = require('./findAlias');

var elementFinder = function elementFinder(){
  /**
   * The list of elements exported by each traversed script.
   */
  var elements = [];

  /**
   * The element being built during a traversal;
   */
  var element;

  /**
   * a set of special case properties. these should only be called
   * when we know we're inside an element definition.
   * @type {Object}
   */
  var propertyHandlers = {
    is: function(node) {
      if (node.type == "Literal") {
        element.is = node.value;
      }
    },
    publish: function(node) {
      if (node.type != "ObjectExpression") {
        return undefined;
      }
      for (var i = 0; i < node.properties.length; i++) {
        var property = node.properties[i];
        var prop = {published: true};
        prop.name = objectKeyToString(property.key);
        if (property.leadingComments && property.leadingComments.length > 0) {
          prop.desc = property.leadingComments[property.leadingComments.length - 1].value;
        }
        prop.type = objectKeyToString(property.value);
        if (prop.type) {
          element.properties.push(prop);
          continue;
        }
        if (property.value.type != "ObjectExpression") {
          throw {
            message: "Cant determine name for property key.",
            location: node.loc.start
          };
        }
        /**
         * Parse the expression inside a publish object block.
         * publish: {
         *   key: {
         *     type: String,
         *     notify: true
         *   }
         * }
         */
        for (var j = 0; j < property.value.properties.length; j++) {
          var publishArg = property.value.properties[j];
          var publishKey = objectKeyToString(publishArg.key);
          if (publishKey == "type") {
            prop.type = objectKeyToString(publishArg.value);
            if (!prop.type) {
              throw {
                message: "Invalid type in publish block.",
                location: publishArg.loc.start
              };
            }
            continue;
          }
          if (publishKey == "notify") {
            var val = publishArg.value;
            if (val.type != "Literal" || val.value === undefined) {
              throw {
                message: "Notify expects a conditional.",
                location: publishArg.loc.start
              };
            }
            prop.notify = val.value;
          }
        }
        element.properties.push(prop);
      }
    }
  };

  function objectKeyToString(key) {
    if (key.type == "Identifier") {
      return key.name;
    }
    if (key.type == "Literal") {
      return key.value;
    }
  }


  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "Polymer") {
          element = {};
        }
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "Polymer") {
          if (element) {
            elements.push(element);
            element = undefined;
          }
        }
      }
    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (element && !element.properties) {
        element.properties = [];
        element.methods = [];
        for (var i = 0; i < node.properties.length; i++) {
          var prop = node.properties[i];
          var name = objectKeyToString(prop.key);
          console.log(name);
          if (!name) {
            throw {
              message: "Cant determine name for property key.",
              location: node.loc.start
            };
          }

          if (name in propertyHandlers) {
            propertyHandlers[name](prop.value);
            continue;
          }
          var property = {};
          if (prop.leadingComments && prop.leadingComments.length > 0) {
            property.desc = prop.leadingComments[prop.leadingComments.length - 1];
          }
          if (prop.value.type == "FunctionExpression") {
            property.type = "Function";
          }
          element.properties.push(property);
        }
        return estraverse.VisitorOption.Skip;
      }
    }
  };
  return {visitors: visitors, elements: elements};
};

context.exports = elementFinder;
}(module));