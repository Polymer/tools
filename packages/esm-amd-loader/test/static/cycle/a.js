define(['exports', './b.js'], function(exports, b) {
  exports.a = 'a';
  exports.usesBAtExecution = b.b;
  exports.getterForB = function() {
    return b.b;
  }
});
