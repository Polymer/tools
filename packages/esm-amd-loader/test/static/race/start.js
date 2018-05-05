
define(['./foo.js', './bar.js'], function(foo, bar, baz) {
  window.executionOrder.push('start');
});
