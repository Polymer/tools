/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

/**
 * CleanKill hooks the interrupt handler, and provides callbacks for your code
 * to cleanly shut down before the process exits.
 */

// TODO(rictic): convert this library to promises.

/**
 * The type of a cleankill interrupt handler.
 */
export type Handler = (doneHandling: () => void) => void;

let interruptHandlers: Handler[] = [];

/**
 * Register a handler to occur on SIGINT. All handlers are passed a callback,
 * and the process will be terminated once all handlers complete.
 */
export function onInterrupt(handler: Handler): void {
  interruptHandlers.push(handler);
}

/**
 * Call all interrupt handlers, and call the callback when they all complete.
 *
 * Removes the list of interrupt handlers.
 */
export function close(done: () => void): void {
  let numComplete = 0;
  // You could cheat by calling callbacks multiple times, but that's your bug!
  let total = interruptHandlers.length;
  interruptHandlers.forEach((handler) => {
    handler(() => {
      numComplete = numComplete + 1;
      if (numComplete === total) {
        done();
      }
    });
  });
  interruptHandlers = [];
}

let interrupted = false;

/**
 * Calls all interrupt handlers, then exits with exit code 0.
 *
 * If called more than once it skips waiting for the interrupt handlers to
 * finish and exits with exit code 1.
 *
 * This function is called when a SIGINT is received.
 */
export function interrupt(): void {
  if (interruptHandlers.length === 0) {
    return process.exit(0);
  }
  if (interrupted) {
    console.log('\nKilling process with extreme prejudice');
    return process.exit(1);
  } else {
    interrupted = true;
  }

  close(() => process.exit(0));
  console.log('\nShutting down. Press ctrl-c again to kill immediately.');
}

process.on('SIGINT', interrupt);
