/// <reference path="../polymer/polymer.d.ts" />
/// <reference path="../iron-behaviors/iron-button-state.d.ts" />
/// <reference path="paper-ripple-behavior.d.ts" />

declare namespace Polymer {

  interface PaperButtonBehavior {

    /**
     * The z-depth of this element, from 0-5. Setting to 0 will remove the
     * shadow, and each increasing number greater than 0 will be "deeper"
     * than the last.
     */
    elevation: number;
    hostAttributes: Object|null;

    /**
     * In addition to `IronButtonState` behavior, when space key goes down,
     * create a ripple down effect.
     */
    _spaceKeyDownHandler(event: KeyboardEvent): any;

    /**
     * In addition to `IronButtonState` behavior, when space key goes up,
     * create a ripple up effect.
     */
    _spaceKeyUpHandler(event: KeyboardEvent): any;
    _calculateElevation(): any;
    _computeKeyboardClass(receivedFocusFromKeyboard: any): any;
  }
}
