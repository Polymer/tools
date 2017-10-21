declare namespace Polymer {

  /**
   * Element class mixin that provides Polymer's "legacy" API intended to be
   * backward-compatible to the greatest extent possible with the API
   * found on the Polymer 1.x `Polymer.Base` prototype applied to all elements
   * defined using the `Polymer({...})` function.
   */
  function LegacyElementMixin<T extends new(...args: any[]) => {}>(base: T): {
    new(...args: any[]): {
      isAttached: boolean;
      __boundListeners: any;
      _debouncers: any;

      /**
       * Provides an override implementation of `attributeChangedCallback`
       * which adds the Polymer legacy API's `attributeChanged` method.
       */
      attributeChangedCallback(name: string, old: string|null, value: string|null): any;

      /**
       * Overrides the default `Polymer.PropertyEffects` implementation to
       * add support for class initialization via the `_registered` callback.
       * This is called only when the first instance of the element is created.
       */
      _initializeProperties(): any;

      /**
       * Overrides the default `Polymer.PropertyEffects` implementation to
       * add support for installing `hostAttributes` and `listeners`.
       */
      ready(): any;

      /**
       * Provides an implementation of `connectedCallback`
       * which adds Polymer legacy API's `attached` method.
       */
      connectedCallback(): any;

      /**
       * Provides an implementation of `disconnectedCallback`
       * which adds Polymer legacy API's `detached` method.
       */
      disconnectedCallback(): any;

      /**
       * Legacy callback called during the `constructor`, for overriding
       * by the user.
       */
      created(): any;

      /**
       * Legacy callback called during `connectedCallback`, for overriding
       * by the user.
       */
      attached(): any;

      /**
       * Legacy callback called during `disconnectedCallback`, for overriding
       * by the user.
       */
      detached(): any;

      /**
       * Legacy callback called during `attributeChangedChallback`, for overriding
       * by the user.
       */
      attributeChanged(name: string, old: string|null, value: string|null): any;

      /**
       * Called automatically when an element is initializing.
       * Users may override this method to perform class registration time
       * work. The implementation should ensure the work is performed
       * only once for the class.
       */
      _registered(): any;

      /**
       * Ensures an element has required attributes. Called when the element
       * is being readied via `ready`. Users should override to set the
       * element's required attributes. The implementation should be sure
       * to check and not override existing attributes added by
       * the user of the element. Typically, setting attributes should be left
       * to the element user and not done here; reasonable exceptions include
       * setting aria roles and focusability.
       */
      _ensureAttributes(): any;

      /**
       * Adds element event listeners. Called when the element
       * is being readied via `ready`. Users should override to
       * add any required element event listeners.
       * In performance critical elements, the work done here should be kept
       * to a minimum since it is done before the element is rendered. In
       * these elements, consider adding listeners asynchronously so as not to
       * block render.
       */
      _applyListeners(): any;

      /**
       * Converts a typed JavaScript value to a string.
       * 
       * Note this method is provided as backward-compatible legacy API
       * only.  It is not directly called by any Polymer features. To customize
       * how properties are serialized to attributes for attribute bindings and
       * `reflectToAttribute: true` properties as well as this method, override
       * the `_serializeValue` method provided by `Polymer.PropertyAccessors`.
       */
      serialize(value: any): string|undefined;

      /**
       * Converts a string to a typed JavaScript value.
       * 
       * Note this method is provided as backward-compatible legacy API
       * only.  It is not directly called by any Polymer features.  To customize
       * how attributes are deserialized to properties for in
       * `attributeChangedCallback`, override `_deserializeValue` method
       * provided by `Polymer.PropertyAccessors`.
       */
      deserialize(value: string, type: any): any;

      /**
       * Serializes a property to its associated attribute.
       * 
       * Note this method is provided as backward-compatible legacy API
       * only.  It is not directly called by any Polymer features.
       */
      reflectPropertyToAttribute(property: string, attribute?: string, value?: any): any;

      /**
       * Sets a typed value to an HTML attribute on a node.
       * 
       * Note this method is provided as backward-compatible legacy API
       * only.  It is not directly called by any Polymer features.
       */
      serializeValueToAttribute(value: any, attribute: string, node: Element|null): any;

      /**
       * Copies own properties (including accessor descriptors) from a source
       * object to a target object.
       */
      extend(prototype: Object|null, api: Object|null): Object|null;

      /**
       * Copies props from a source object to a target object.
       * 
       * Note, this method uses a simple `for...in` strategy for enumerating
       * properties.  To ensure only `ownProperties` are copied from source
       * to target and that accessor implementations are copied, use `extend`.
       */
      mixin(target: Object|null, source: Object|null): Object|null;

      /**
       * Sets the prototype of an object.
       * 
       * Note this method is provided as backward-compatible legacy API
       * only.  It is not directly called by any Polymer features.
       */
      chainObject(object: Object|null, prototype: Object|null): Object|null;

      /**
       * Calls `importNode` on the `content` of the `template` specified and
       * returns a document fragment containing the imported content.
       */
      instanceTemplate(template: HTMLTemplateElement|null): DocumentFragment|null;

      /**
       * Dispatches a custom event with an optional detail value.
       */
      fire(type: string, detail?: any, options?: any): Event|null;

      /**
       * Convenience method to add an event listener on a given element,
       * late bound to a named method on this element.
       */
      listen(node: Element|null, eventName: string, methodName: string): any;

      /**
       * Convenience method to remove an event listener from a given element,
       * late bound to a named method on this element.
       */
      unlisten(node: Element|null, eventName: string, methodName: string): any;

      /**
       * Override scrolling behavior to all direction, one direction, or none.
       * 
       * Valid scroll directions:
       *   - 'all': scroll in any direction
       *   - 'x': scroll only in the 'x' direction
       *   - 'y': scroll only in the 'y' direction
       *   - 'none': disable scrolling for this node
       */
      setScrollDirection(direction?: string, node?: Element|null): any;

      /**
       * Convenience method to run `querySelector` on this local DOM scope.
       * 
       * This function calls `Polymer.dom(this.root).querySelector(slctr)`.
       */
      $$(slctr: string): Element|null;

      /**
       * Force this element to distribute its children to its local dom.
       * This should not be necessary as of Polymer 2.0.2 and is provided only
       * for backwards compatibility.
       */
      distributeContent(): any;

      /**
       * Returns a list of nodes that are the effective childNodes. The effective
       * childNodes list is the same as the element's childNodes except that
       * any `<content>` elements are replaced with the list of nodes distributed
       * to the `<content>`, the result of its `getDistributedNodes` method.
       */
      getEffectiveChildNodes(): Array<Node|null>|null;

      /**
       * Returns a list of nodes distributed within this element that match
       * `selector`. These can be dom children or elements distributed to
       * children that are insertion points.
       */
      queryDistributedElements(selector: string): Array<Node|null>|null;

      /**
       * Returns a list of elements that are the effective children. The effective
       * children list is the same as the element's children except that
       * any `<content>` elements are replaced with the list of elements
       * distributed to the `<content>`.
       */
      getEffectiveChildren(): Array<Node|null>|null;

      /**
       * Returns a string of text content that is the concatenation of the
       * text content's of the element's effective childNodes (the elements
       * returned by <a href="#getEffectiveChildNodes>getEffectiveChildNodes</a>.
       */
      getEffectiveTextContent(): string;

      /**
       * Returns the first effective childNode within this element that
       * match `selector`. These can be dom child nodes or elements distributed
       * to children that are insertion points.
       */
      queryEffectiveChildren(selector: string): any;

      /**
       * Returns a list of effective childNodes within this element that
       * match `selector`. These can be dom child nodes or elements distributed
       * to children that are insertion points.
       */
      queryAllEffectiveChildren(selector: string): Array<Node|null>|null;

      /**
       * Returns a list of nodes distributed to this element's `<slot>`.
       * 
       * If this element contains more than one `<slot>` in its local DOM,
       * an optional selector may be passed to choose the desired content.
       */
      getContentChildNodes(slctr?: string): Array<Node|null>|null;

      /**
       * Returns a list of element children distributed to this element's
       * `<slot>`.
       * 
       * If this element contains more than one `<slot>` in its
       * local DOM, an optional selector may be passed to choose the desired
       * content.  This method differs from `getContentChildNodes` in that only
       * elements are returned.
       */
      getContentChildren(slctr?: string): Array<HTMLElement|null>|null;

      /**
       * Checks whether an element is in this element's light DOM tree.
       */
      isLightDescendant(node: Node|null): boolean;

      /**
       * Checks whether an element is in this element's local DOM tree.
       */
      isLocalDescendant(node?: Element|null): boolean;

      /**
       * NOTE: should now be handled by ShadyCss library.
       */
      scopeSubtree(container: any, shouldObserve: any): any;

      /**
       * Returns the computed style value for the given property.
       */
      getComputedStyleValue(property: string): string;

      /**
       * Call `debounce` to collapse multiple requests for a named task into
       * one invocation which is made after the wait time has elapsed with
       * no new request.  If no wait time is given, the callback will be called
       * at microtask timing (guaranteed before paint).
       * 
       *     debouncedClickAction(e) {
       *       // will not call `processClick` more than once per 100ms
       *       this.debounce('click', function() {
       *        this.processClick();
       *       } 100);
       *     }
       */
      debounce(jobName: string, callback: () => any, wait: number): Object|null;

      /**
       * Returns whether a named debouncer is active.
       */
      isDebouncerActive(jobName: string): boolean;

      /**
       * Immediately calls the debouncer `callback` and inactivates it.
       */
      flushDebouncer(jobName: string): any;

      /**
       * Cancels an active debouncer.  The `callback` will not be called.
       */
      cancelDebouncer(jobName: string): any;

      /**
       * Runs a callback function asynchronously.
       * 
       * By default (if no waitTime is specified), async callbacks are run at
       * microtask timing, which will occur before paint.
       */
      async(callback: Function|null, waitTime?: number): number;

      /**
       * Cancels an async operation started with `async`.
       */
      cancelAsync(handle: number): any;

      /**
       * Convenience method for creating an element and configuring it.
       */
      create(tag: string, props: Object|null): Element|null;

      /**
       * Convenience method for importing an HTML document imperatively.
       * 
       * This method creates a new `<link rel="import">` element with
       * the provided URL and appends it to the document to start loading.
       * In the `onload` callback, the `import` property of the `link`
       * element will contain the imported document contents.
       */
      importHref(href: string, onload: Function|null, onerror: Function|null, optAsync: boolean): HTMLLinkElement|null;

      /**
       * Polyfill for Element.prototype.matches, which is sometimes still
       * prefixed.
       */
      elementMatches(selector: string, node?: Element|null): boolean;

      /**
       * Toggles an HTML attribute on or off.
       */
      toggleAttribute(name: string, bool?: boolean, node?: Element|null): any;

      /**
       * Toggles a CSS class on or off.
       */
      toggleClass(name: string, bool?: boolean, node?: Element|null): any;

      /**
       * Cross-platform helper for setting an element's CSS `transform` property.
       */
      transform(transformText: string, node?: Element|null): any;

      /**
       * Cross-platform helper for setting an element's CSS `translate3d`
       * property.
       */
      translate3d(x: number, y: number, z: number, node?: Element|null): any;

      /**
       * Removes an item from an array, if it exists.
       * 
       * If the array is specified by path, a change notification is
       * generated, so that observers, data bindings and computed
       * properties watching that path can update.
       * 
       * If the array is passed directly, **no change
       * notification is generated**.
       */
      arrayDelete(arrayOrPath: string|Array<number|string>, item: any): any[]|null;

      /**
       * Facades `console.log`/`warn`/`error` as override point.
       */
      _logger(level: string, args: any[]|null): any;

      /**
       * Facades `console.log` as an override point.
       */
      _log(...args: any): any;

      /**
       * Facades `console.warn` as an override point.
       */
      _warn(...args: any): any;

      /**
       * Facades `console.error` as an override point.
       */
      _error(...args: any): any;

      /**
       * Formats a message using the element type an a method name.
       */
      _logf(methodName: string, ...args: any): any[]|null;
    }
  } & T
}
