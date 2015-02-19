(function(context){
"use strict";
var findAlias = function findAlias(names, aliases, name) {
  return aliases[names.indexOf(name)];
};

context.exports = findAlias;
}(module));