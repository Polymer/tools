/// <reference path="../utils/boot.d.ts" />
/// <reference path="../utils/settings.d.ts" />
/// <reference path="../utils/flattened-nodes-observer.d.ts" />
/// <reference path="../utils/flush.d.ts" />

declare namespace Polymer {

  namespace dom {


    /**
     * Cross-platform `element.matches` shim.
     */
    function matchesSelector(node: Element, selector: string): boolean;
  }

  /**
   * Node API wrapper class returned from `Polymer.dom.(target)` when
   * `target` is a `Node`.
   */
  class DomApi {

    /**
     * Returns an instance of `Polymer.FlattenedNodesObserver` that
     * listens for node changes on this element.
     */
    observeNodes(callback: Function|null): Polymer.FlattenedNodesObserver|null;

    /**
     * Disconnects an observer previously created via `observeNodes`
     */
    unobserveNodes(observerHandle: Polymer.FlattenedNodesObserver|null): any;

    /**
     * Provided as a backwards-compatible API only.  This method does nothing.
     */
    notifyObserver(): any;

    /**
     * Returns true if the provided node is contained with this element's
     * light-DOM children or shadow root, including any nested shadow roots
     * of children therein.
     */
    deepContains(node: Node|null): boolean;

    /**
     * Returns the root node of this node.  Equivalent to `getRoodNode()`.
     */
    getOwnerRoot(): Node|null;

    /**
     * For slot elements, returns the nodes assigned to the slot; otherwise
     * an empty array. It is equivalent to `<slot>.addignedNodes({flatten:true})`.
     */
    getDistributedNodes(): Array<Node|null>|null;

    /**
     * Returns an array of all slots this element was distributed to.
     */
    getDestinationInsertionPoints(): Array<HTMLSlotElement|null>|null;

    /**
     * Calls `importNode` on the `ownerDocument` for this node.
     */
    importNode(node: Node|null, deep: boolean): Node|null;
    getEffectiveChildNodes(): any[]|null;

    /**
     * Returns a filtered list of flattened child elements for this element based
     * on the given selector.
     */
    queryDistributedElements(selector: string): Array<HTMLElement|null>|null;
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
  function dom(obj: Node|Event|null): DomApi|null|EventApi;
}

/**
 * Event API wrapper class returned from `Polymer.dom.(target)` when
 * `target` is an `Event`.
 */
declare class EventApi {
}
