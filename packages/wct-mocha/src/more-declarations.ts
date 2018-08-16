declare namespace Mocha {
  namespace utils {
    function highlightTags(somethingSomething: string): void;
  }

  interface IRunner extends NodeJS.EventEmitter {
    name?: string;
    total: number;
  }

  interface IRunnable {
    parent?: ISuite;
    root: boolean;
    state?: 'passed'|'failed';
    pending: boolean;
  }

  interface ISuite {
    root: boolean;
  }

  // let Runner: {prototype: IRunner; immediately(callback: () => void): void};
}

interface Window {
  /**
   * A function to filter out expected uncaught errors.
   *
   * If this function exists, then any events fired from the window's 'error'
   * will be passed to this function. If it returns true, then the error event
   * will not be logged and will not cause tests to fail.
   */
  uncaughtErrorFilter?(errorEvent: ErrorEvent): boolean;
}

interface HTMLElement {
  isConnected: boolean;
}
interface SVGElement {
  isConnected: boolean;
}