declare namespace Polymer {

  /**
   * `Polymer.PaperRippleBehavior` dynamically implements a ripple
   * when the element has focus via pointer or keyboard.
   * 
   * NOTE: This behavior is intended to be used in conjunction with and after
   * `Polymer.IronButtonState` and `Polymer.IronControlState`.
   */
  interface PaperRippleBehavior {

    /**
     * If true, the element will not produce a ripple effect when interacted
     * with via the pointer.
     */
    noink: boolean;
    _rippleContainer: Element|null|undefined;

    /**
     * Ensures a `<paper-ripple>` element is available when the element is
     * focused.
     */
    _buttonStateChanged(): any;

    /**
     * In addition to the functionality provided in `IronButtonState`, ensures
     * a ripple effect is created when the element is in a `pressed` state.
     */
    _downHandler(event: any): any;

    /**
     * Ensures this element contains a ripple effect. For startup efficiency
     * the ripple effect is dynamically on demand when needed.
     */
    ensureRipple(optTriggeringEvent?: Event): any;

    /**
     * Returns the `<paper-ripple>` element used by this element to create
     * ripple effects. The element's ripple is created on demand, when
     * necessary, and calling this method will force the
     * ripple to be created.
     */
    getRipple(): any;

    /**
     * Returns true if this element currently contains a ripple effect.
     */
    hasRipple(): boolean;

    /**
     * Create the element's ripple effect via creating a `<paper-ripple>`.
     * Override this method to customize the ripple element.
     */
    _createRipple(): PaperRippleElement;
    _noinkChanged(noink: any): any;
  }

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

  /**
   * `Polymer.PaperInkyFocusBehavior` implements a ripple when the element has keyboard focus.
   */
  interface PaperInkyFocusBehavior {
    _createRipple(): any;
    _focusedChanged(receivedFocusFromKeyboard: any): any;
  }

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
