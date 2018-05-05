define([], function() {
  window.executionOrder.push('afterFailure');
  assert.fail('should have been stopped by failure.js');
});
