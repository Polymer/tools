if (window.executedExportsMeta) {
  throw new Error('module "exports-meta" was already executed');
}
window.executedExportsMeta = true;

define(['exports', 'meta'], function(exports, meta) {
  exports.meta = meta;
});
