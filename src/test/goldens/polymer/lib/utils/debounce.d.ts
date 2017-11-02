declare namespace Polymer {

  class Debouncer {

    /**
     * Sets the scheduler; that is, a module with the Async interface,
     * a callback and optional arguments to be passed to the run function
     * from the async module.
     */
    setConfig(asyncModule: AsyncModule, callback: () => any): any;

    /**
     * Cancels an active debouncer and returns a reference to itself.
     */
    cancel(): any;

    /**
     * Flushes an active debouncer and returns a reference to itself.
     */
    flush(): any;

    /**
     * Returns true if the debouncer is active.
     */
    isActive(): boolean;
  }
}
