/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   lib/elements/dom-if.js
 */


// tslint:disable:variable-name Describing an API that's defined elsewhere.

declare module 'goog:polymer.polymer.lib.elements.domIf' {

  import {PolymerElement} from 'goog:polymer.polymer.polymerElement'; // from //third_party/javascript/polymer/v2/polymer

  import {templatize} from 'goog:polymer.polymer.lib.utils.templatize'; // from //third_party/javascript/polymer/v2/polymer

  import {Debouncer} from 'goog:polymer.polymer.lib.utils.debounce'; // from //third_party/javascript/polymer/v2/polymer

  import {enqueueDebouncer, flush} from 'goog:polymer.polymer.lib.utils.flush'; // from //third_party/javascript/polymer/v2/polymer

  import {microTask} from 'goog:polymer.polymer.lib.utils.async'; // from //third_party/javascript/polymer/v2/polymer

  import {root as root$0} from 'goog:polymer.polymer.lib.utils.path'; // from //third_party/javascript/polymer/v2/polymer

  export {DomIf};

  /**
   * The `<dom-if>` element will stamp a light-dom `<template>` child when
   * the `if` property becomes truthy, and the template can use Polymer
   * data-binding and declarative event features when used in the context of
   * a Polymer element's template.
   *
   * When `if` becomes falsy, the stamped content is hidden but not
   * removed from dom. When `if` subsequently becomes truthy again, the content
   * is simply re-shown. This approach is used due to its favorable performance
   * characteristics: the expense of creating template content is paid only
   * once and lazily.
   *
   * Set the `restamp` property to true to force the stamped content to be
   * created / destroyed when the `if` condition changes.
   */
  class DomIf extends PolymerElement {

    /**
     * A boolean indicating whether this template should stamp.
     */
    if: boolean|null|undefined;

    /**
     * When true, elements will be removed from DOM and discarded when `if`
     * becomes false and re-created and added back to the DOM when `if`
     * becomes true.  By default, stamped elements will be hidden but left
     * in the DOM when `if` becomes false, which is generally results
     * in better performance.
     */
    restamp: boolean|null|undefined;
    connectedCallback(): void;
    disconnectedCallback(): void;

    /**
     * Forces the element to render its content. Normally rendering is
     * asynchronous to a provoking change. This is done for efficiency so
     * that multiple changes trigger only a single render. The render method
     * should be called if, for example, template rendering is required to
     * validate application state.
     */
    render(): void;

    /**
     * Shows or hides the template instance top level child elements. For
     * text nodes, `textContent` is removed while "hidden" and replaced when
     * "shown."
     */
    _showHideChildren(): void;
  }

  global {

    interface HTMLElementTagNameMap {
      "dom-if": DomIf;
    }
  }
}
