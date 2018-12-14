/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
import './boot.js';

/**
 * Provides basic tracking of element definitions (registrations) and
 * instance counts.
 *
 * @summary Provides basic tracking of element definitions (registrations) and
 * instance counts.
 */
`TODO(modulizer): A namespace named Polymer.telemetry was
declared here. The surrounding comments should be reviewed,
and this string can then be deleted`;

/**
 * Total number of Polymer element instances created.
 * @type {number}
 */
export const instanceCount = 0;

/**
 * Array of Polymer element classes that have been finalized.
 * @type {Array<Polymer.Element>}
 */
export const registrations = [];

/**
 * @param {!PolymerElementConstructor} prototype Element prototype to log
 * @this {this}
 * @private
 */
export function _regLog(prototype) {
  console.log('[' + prototype.is + ']: registered');
}

/**
 * Registers a class prototype for telemetry purposes.
 * @param {HTMLElement} prototype Element prototype to register
 * @this {this}
 * @protected
 */
export function register(prototype) {
  registrations.push(prototype);
  undefined && _regLog(prototype);
}

/**
 * Logs all elements registered with an `is` to the console.
 * @public
 * @this {this}
 */
export function dumpRegistrations() {
  registrations.forEach(_regLog);
}
