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

import { pathFromUrl } from './resolve-url.js';
export const useShadow = !(window.ShadyDOM);
export const useNativeCSSProperties = Boolean(!window.ShadyCSS || window.ShadyCSS.nativeCss);
export const useNativeCustomElements = !(window.customElements.polyfillWrapFlushCallback);

/**
 * Globally settable property that is automatically assigned to
 * `Polymer.ElementMixin` instances, useful for binding in templates to
 * make URL's relative to an application's root.  Defaults to the main
 * document URL, but can be overridden by users.  It may be useful to set
 * `Polymer.rootPath` to provide a stable application mount path when
 * using client side routing.
 *
 */
export let rootPath = undefined ||
  pathFromUrl(document.baseURI || window.location.href);

/**
 * Sets the global rootPath property used by `Polymer.ElementMixin` and
 * available via `Polymer.rootPath`.
 *
 * @param {string} path The new root path
 * @return {void}
 */
export const setRootPath = function(path) {
  rootPath = path;
};

/**
 * A global callback used to sanitize any value before inserting it into the DOM. The callback signature is:
 *
 *     Polymer = {
 *       sanitizeDOMValue: function(value, name, type, node) { ... }
 *     }
 *
 * Where:
 *
 * `value` is the value to sanitize.
 * `name` is the name of an attribute or property (for example, href).
 * `type` indicates where the value is being inserted: one of property, attribute, or text.
 * `node` is the node where the value is being inserted.
 *
 * @type {(function(*,string,string,Node):*)|undefined}
 */
export let sanitizeDOMValue = undefined || null;

/**
 * Sets the global sanitizeDOMValue available via `Polymer.sanitizeDOMValue`.
 *
 * @param {(function(*,string,string,Node):*)|undefined} newSanitizeDOMValue the global sanitizeDOMValue callback
 * @return {void}
 */
export const setSanitizeDOMValue = function(newSanitizeDOMValue) {
  sanitizeDOMValue = newSanitizeDOMValue;
};

/**
 * Globally settable property to make Polymer Gestures use passive TouchEvent listeners when recognizing gestures.
 * When set to `true`, gestures made from touch will not be able to prevent scrolling, allowing for smoother
 * scrolling performance.
 * Defaults to `false` for backwards compatibility.
 *
 */
export let passiveTouchGestures = passiveTouchGestures || false;

/**
 * Sets `passiveTouchGestures` globally for all elements using Polymer Gestures.
 *
 * @param {boolean} usePassive enable or disable passive touch gestures globally
 * @return {void}
 */
export const setPassiveTouchGestures = function(usePassive) {
  passiveTouchGestures = usePassive;
};

export let legacyOptimizations = legacyOptimizations ||
    window.PolymerSettings && window.PolymerSettings.legacyOptimizations || false;

/**
 * Sets `legacyOptimizations` globally for all elements. Enables
 * optimizations when only legacy Polymer() style elements are used.
 *
 * @param {boolean} useLegacyOptimizations enable or disable legacy optimizations globally.
 * @return {void}
 */
export const setLegacyOptimizations = function(useLegacyOptimizations) {
  legacyOptimizations = useLegacyOptimizations;
};
