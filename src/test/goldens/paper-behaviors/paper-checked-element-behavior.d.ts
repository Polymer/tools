/// <reference path="../polymer/polymer.d.ts" />
/// <reference path="../iron-checked-element-behavior/iron-checked-element-behavior.d.ts" />
/// <reference path="paper-inky-focus-behavior.d.ts" />

declare namespace Polymer {

  /**
   * Use `Polymer.PaperCheckedElementBehavior` to implement a custom element
   * that has a `checked` property similar to `Polymer.IronCheckedElementBehavior`
   * and is compatible with having a ripple effect.
   */
  interface PaperCheckedElementBehavior {

    /**
     * Synchronizes the element's `active` and `checked` state.
     */
    _buttonStateChanged(): any;

    /**
     * Synchronizes the element's checked state with its ripple effect.
     */
    _checkedChanged(): any;
  }
}
