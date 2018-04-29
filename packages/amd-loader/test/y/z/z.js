window.checkExecuted('z');

define(['../../x.js', 'exports'], function(x, exports) {
  exports.zx = 'z' + x.x;
});
