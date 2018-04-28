if (window.executedZ) {
  throw new Error('module "z" was already executed');
}
window.executedZ = true;

define(['../../x.js', 'exports'], function(x, exports) {
  exports.zx = 'z' + x.x;
});
