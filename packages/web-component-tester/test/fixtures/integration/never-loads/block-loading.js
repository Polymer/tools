{
  // This script should only run in the context of the test runner's top level
  // page, which is the page that WCT will attempt to reload if it doesn't
  // contact WCT's server.
  if (location.pathname === '/components/never-loads/generated-index.html') {
    // Use `localStorage` to track how many times this page has been loaded.
    var key = 'loadCount';
    // Note that (1) if a key is not set in `localStorage`, then `getItem`
    // returns null and (2) that `Number(null) === 0`.
    var previousLoadCount = Number(localStorage.getItem(key));
    localStorage.setItem(key, previousLoadCount + 1);
    // Open a comment to prevent all other scripts from loading, including
    // the one which connects to WCT.
    document.write('<!--');

    document.addEventListener('readystatechange', function listener() {
      if (document.readyState === 'loading') return;
      document.removeEventListener('readystatechange', listener);
      document.body.appendChild(new Text(
          `This is load attempt #${previousLoadCount + 1}. All other ` +
          'content on this page was disabled to simulate failing to load. ' +
          'The page should never load successfully. WCT should automatically ' +
          'reload the page in a few seconds.'));
    });
  }
}
