/// <reference path="bower_components/polymer/polymer.d.ts" />
/// <reference path="bower_components/iron-behaviors/iron-button-state.d.ts" />
/// <reference path="paper-ripple-behavior.d.ts" />

declare namespace Polymer {

  /**
   * `Polymer.PaperInkyFocusBehavior` implements a ripple when the element has keyboard focus.
   */
  interface PaperInkyFocusBehavior {
    _createRipple(): any;
    _focusedChanged(receivedFocusFromKeyboard: any): any;
  }
}
