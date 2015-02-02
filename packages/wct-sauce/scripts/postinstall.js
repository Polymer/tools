// People frequently sudo install web-component-tester, and we have to be a
// little careful about file permissions.
//
// sauce-connect-launcher downloads and caches the sc binary into its package
// directory the first time you try to connect. If WCT is installed via sudo,
// sauce-connect-launcher will be unable to write to its directory, and fail.
//
// So, we prefetch it during install ourselves.

// Unfortunately, this process runs up against a npm race condition:
// https://github.com/npm/npm/issues/6624
//
// As a workaround, our best bet is to retry with backoff.
function requireSauceConnectLauncher(done, attempt) {
  attempt = attempt || 0;
  var sauceConnectLauncher;
  try {
    sauceConnectLauncher = require('sauce-connect-launcher');
  } catch (error) {
    if (attempt > 3) {
      throw error;
    }
    setTimeout(
      requireSauceConnectLauncher.bind(null, done, attempt + 1),
      Math.pow(2, attempt) // Exponential backoff to play it safe.
    );
  }
  // All is well.
  done(sauceConnectLauncher);
}

console.log('Prefetching the Sauce Connect binary.');
requireSauceConnectLauncher(function(sauceConnectLauncher) {
  sauceConnectLauncher.download({
    logger: console.log.bind(console),
  }, function(error) {
    if (error) {
      console.log('Failed to download sauce connect binary:', error);
      console.log('sauce-connect-launcher will attempt to re-download next time it is run.');
      // We explicitly do not fail the install process if this happens; the user
      // can still recover, unless their permissions are completely screwey.
    }
  });
});
