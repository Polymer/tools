interface PaperButton extends Polymer.Element, Polymer.PaperButtonBehavior {

  /**
   * If true, the button should be styled with a shadow.
   */
  raised: boolean;
  _calculateElevation(): any;
}
