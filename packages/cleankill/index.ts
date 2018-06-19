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

/**
 * The type of a cleankill interrupt handler.
 */
export type Handler = () => Promise<void>;

const interruptHandlers: Handler[] = [];

/**
 * Register a handler to occur on SIGINT. The handler must return a promise if
 * it has any asynchronous work to do. The process will be terminated once
 * all handlers complete. If a handler throws or the promise it returns rejects
 * then the process will be terminated immediately.
 */
export function onInterrupt(handler: Handler): void {
  interruptHandlers.push(handler);
}

/**
 * Waits for all promises to settle, then rejects with the first error, if any.
 */
export async function promiseAllStrict(
      promises: Promise<any>[]): Promise<void> {
  let errors = await Promise.all(
      promises.map((p) => p.then(() => null, (e) => e)));
  let firstError = errors.find((e) => e != null);
  if (firstError) {
    throw firstError;
  }
}

/**
 * Call all interrupt handlers, and call the callback when they all complete.
 *
 * Clears the list of interrupt handlers.
 */
export async function close(): Promise<void> {
  const promises = interruptHandlers.map((handler) => handler());
  // Empty the array in place. Looks weird, totally works.
  interruptHandlers.length = 0;

  await promiseAllStrict(promises);
}

let interrupted = false;

/**
 * Calls all interrupt handlers, then exits with exit code 0.
 *
 * If called more than once it skips waiting for the interrupt handlers to
 * finish and exits with exit code 1. If there are any errors with interrupt
 * handlers, the process exits immediately with exit code 2.
 *
 * This function is called when a SIGINT is received.
 */
export function interrupt(): void {
  if (interrupted) {
    console.log('\nGot multiple interrupts, exiting immediately!');
    return process.exit(1);
  }
  interrupted = true;

  close().then(() => process.exit(0), (error) => {
    error = error || 'cleankill interrupt handler failed without a message';
    console.error(error.stack || error.message || error);
    process.exit(2);
  });
  console.log('\nShutting down. Press ctrl-c again to kill immediately.');
}

process.on('SIGINT', interrupt);
