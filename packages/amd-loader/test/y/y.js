if (window.executedY) {
  throw new Error('module "y" was already executed');
}
window.executedY = true;

define(['exports'], function(exports) {
  exports.y = 'y';
});
