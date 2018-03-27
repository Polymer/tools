import './boot.js';

let debouncerQueue = [];

/**
 * Adds a `Polymer.Debouncer` to a list of globally flushable tasks.
 *
 * @param {!Polymer.Debouncer} debouncer Debouncer to enqueue
 * @return {void}
 */
export const enqueueDebouncer = function(debouncer) {
  debouncerQueue.push(debouncer);
};

function flushDebouncers() {
  const didFlush = Boolean(debouncerQueue.length);
  while (debouncerQueue.length) {
    try {
      debouncerQueue.shift().flush();
    } catch(e) {
      setTimeout(() => {
        throw e;
      });
    }
  }
  return didFlush;
}

/**
 * Forces several classes of asynchronously queued tasks to flush:
 * - Debouncers added via `enqueueDebouncer`
 * - ShadyDOM distribution
 *
 * @return {void}
 */
export const flush = function() {
  let shadyDOM, debouncers;
  do {
    shadyDOM = window.ShadyDOM && ShadyDOM.flush();
    if (window.ShadyCSS && window.ShadyCSS.ScopingShim) {
      window.ShadyCSS.ScopingShim.flush();
    }
    debouncers = flushDebouncers();
  } while (shadyDOM || debouncers);
};
