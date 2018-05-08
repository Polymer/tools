declare namespace Mocha {
  interface UtilsStatic {
    highlightTags(somethingSomething: string): void;
  }
  let utils: UtilsStatic;
  interface IRunner extends NodeJS.EventEmitter {
    name?: string;
    total: number;
  }

  interface IRunnable {
    parent: ISuite;
    root: boolean;
    state: 'passed'|'failed'|undefined;
    pending: boolean;
  }

  interface ISuite {
    root: boolean;
  }

  let Runner: {prototype: IRunner; immediately(callback: () => void): void};
}

declare namespace SocketIO {
  interface Server {
    off(): void;
  }
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
