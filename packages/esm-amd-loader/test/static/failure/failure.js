define([], function() {
  window.executionOrder.push('failure');
  throw new Error('failure.js is supposed to fail');
});
