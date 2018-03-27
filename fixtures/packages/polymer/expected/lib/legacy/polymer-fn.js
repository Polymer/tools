import { Class } from './class.js';

/**
 * Legacy class factory and registration helper for defining Polymer
 * elements.
 *
 * This method is equivalent to
 * `customElements.define(info.is, Polymer.Class(info));`
 *
 * See `Polymer.Class` for details on valid legacy metadata format for `info`.
 *
 * @global
 * @override
 * @function Polymer
 * @param {!PolymerInit} info Object containing Polymer metadata and functions
 *   to become class methods.
 * @return {function(new: HTMLElement)} Generated class
 * @suppress {duplicate, invalidCasts, checkTypes}
 */
export const Polymer = function(info) {
  // if input is a `class` (aka a function with a prototype), use the prototype
  // remember that the `constructor` will never be called
  let klass;
  if (typeof info === 'function') {
    klass = info;
  } else {
    klass = Class(info);
  }
  customElements.define(klass.is, /** @type {!HTMLElement} */(klass));
  return klass;
};
