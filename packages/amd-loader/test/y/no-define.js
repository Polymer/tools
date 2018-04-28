if (window.executedNoDefine) {
  throw new Error('module "no-define" was already executed');
}
window.executedNoDefine = true;
