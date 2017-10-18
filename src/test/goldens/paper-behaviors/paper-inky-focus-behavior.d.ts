declare namespace Polymer {

  /**
   * `Polymer.PaperInkyFocusBehavior` implements a ripple when the element has keyboard focus.
   */
  interface PaperInkyFocusBehavior {
    _createRipple(): any;
    _focusedChanged(receivedFocusFromKeyboard: any): any;
  }
}
