/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

// Attributes that are on every HTMLElement.
export const sharedAttributes = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tabindex',
  'accesskey',
  'draggable',
  'spellcheck',
  'innertext',
  'contextmenu',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'contenteditable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'class',
  'slot',


  // https://html.spec.whatwg.org/multipage/dom.html#global-attributes
  'itemid',
  'itemprop',
  'itemref',
  'itemscope',
  'itemtype',
  'is',
  'style',

  // aria-* http://www.w3.org/TR/wai-aria/states_and_properties#state_prop_def
  // role: http://www.w3.org/TR/wai-aria/host_languages#host_general_role
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-controls',
  'aria-describedby',
  'aria-disabled',
  'aria-dropeffect',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'role',
]);


// Properties that are on every HTMLElement
export const sharedProperties = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tabIndex',
  'accessKey',
  'draggable',
  'spellcheck',
  'innerText',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'contentEditable',
  'isContentEditable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'className',
  'slot',


  'is',
]);
