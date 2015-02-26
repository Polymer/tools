(function(context){
"use strict";
var findAlias = function findAlias(names, aliases, name) {
  if (names == undefined) {
    return null;
  }
  return aliases[names.indexOf(name)];
};

context.exports = findAlias;
}(module));