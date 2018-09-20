/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
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
