declare namespace Polymer {

  namespace dom {


    /**
     * Cross-platform `element.matches` shim.
     */
    function matchesSelector(node: Element, selector: string): boolean;
  }


  /**
   * Legacy DOM and Event manipulation API wrapper factory used to abstract
   * differences between native Shadow DOM and "Shady DOM" when polyfilling on
   * older browsers.
   * 
   * Note that in Polymer 2.x use of `Polymer.dom` is no longer required and
   * in the majority of cases simply facades directly to the standard native
   * API.
   */
  function dom(obj: Node|Event|null): DomApi|null|EventApi|null;
}
