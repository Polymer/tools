declare namespace Polymer {

  namespace Async {

    namespace timeOut {


      /**
       * Returns a sub-module with the async interface providing the provided
       * delay.
       */
      function after(delay: number): AsyncInterface|null;
    }

    namespace idlePeriod {


      /**
       * Enqueues a function called at `requestIdleCallback` timing.
       */
      function run(fn: (p0: IdleDeadline|null) => any): number;


      /**
       * Cancels a previously enqueued `idlePeriod` callback.
       */
      function cancel(handle: number): any;
    }

    namespace microTask {


      /**
       * Enqueues a function called at microtask timing.
       */
      function run(callback: Function|null): number;


      /**
       * Cancels a previously enqueued `microTask` callback.
       */
      function cancel(handle: number): any;
    }
  }
}
