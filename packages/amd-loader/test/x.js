if (window.executedX) {
  throw new Error('module "x" was already executed');
}
window.executedX = true;

define(['exports'], function(exports) {
  exports.x = 'x';
});
