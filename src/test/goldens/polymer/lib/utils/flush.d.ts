/// <reference path="boot.d.ts" />

declare namespace Polymer {


  /**
   * Adds a `Polymer.Debouncer` to a list of globally flushable tasks.
   */
  function enqueueDebouncer(debouncer: Polymer.Debouncer|null): any;


  /**
   * Forces several classes of asynchronously queued tasks to flush:
   * - Debouncers added via `enqueueDebouncer`
   * - ShadyDOM distribution
   */
  function flush(): any;
}
