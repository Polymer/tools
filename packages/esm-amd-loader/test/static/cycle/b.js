define(['exports', './a.js'], function(exports, a) {
  exports.b = 'b';
  exports.usesAAtExecution = a.a;
  exports.getterForA = function() {
    return a.a;
  }
});
