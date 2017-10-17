namespace Polymer {


  /**
   * Wraps an ES6 class expression mixin such that the mixin is only applied
   * if it has not already been applied its base argument. Also memoizes mixin
   * applications.
   */
  function dedupingMixin(mixin: T|null): any;

  namespace CaseMap {


    /**
     * Converts "dash-case" identifier (e.g. `foo-bar-baz`) to "camelCase"
     * (e.g. `fooBarBaz`).
     */
    function dashToCamelCase(dash: string): string;


    /**
     * Converts "camelCase" identifier (e.g. `fooBarBaz`) to "dash-case"
     * (e.g. `foo-bar-baz`).
     */
    function camelToDashCase(camel: string): string;
  }

  namespace Async {

    namespace timeOut {


      /**
       * Returns a sub-module with the async interface providing the provided
       * delay.
       */
      function after(delay: number): AsyncInterface|null;
    }

    namespace idlePeriod {


      /**
       * Enqueues a function called at `requestIdleCallback` timing.
       */
      function run(fn: (p0: IdleDeadline|null) => any): number;


      /**
       * Cancels a previously enqueued `idlePeriod` callback.
       */
      function cancel(handle: number): any;
    }

    namespace microTask {


      /**
       * Enqueues a function called at microtask timing.
       */
      function run(callback: Function|null): number;


      /**
       * Cancels a previously enqueued `microTask` callback.
       */
      function cancel(handle: number): any;
    }
  }

  namespace ResolveUrl {


    /**
     * Resolves the given URL against the provided `baseUri'.
     */
    function resolveUrl(url: string, baseURI: any): string;


    /**
     * Resolves any relative URL's in the given CSS text against the provided
     * `ownerDocument`'s `baseURI`.
     */
    function resolveCss(cssText: string, baseURI: string): string;


    /**
     * Returns a path from a given `url`. The path includes the trailing
     * `/` from the url.
     */
    function pathFromUrl(url: string): string;
  }


  /**
   * Sets the global rootPath property used by `Polymer.ElementMixin` and
   * available via `Polymer.rootPath`.
   */
  function setRootPath(path: string): any;


  /**
   * Sets the global sanitizeDOMValue available via `Polymer.sanitizeDOMValue`.
   */
  function setSanitizeDOMValue(newSanitizeDOMValue: ((p0: any, p1: string, p2: string, p3: Node|null) => any|undefined)): any;


  /**
   * Sets `passiveTouchGestures` globally for all elements using Polymer Gestures.
   */
  function setPassiveTouchGestures(usePassive: boolean): any;

  namespace StyleGather {


    /**
     * Returns CSS text of styles in a space-separated list of `dom-module`s.
     */
    function cssFromModules(moduleIds: string): string;


    /**
     * Returns CSS text of styles in a given `dom-module`.  CSS in a `dom-module`
     * can come either from `<style>`s within the first `<template>`, or else
     * from one or more `<link rel="import" type="css">` links outside the
     * template.
     * 
     * Any `<styles>` processed are removed from their original location.
     */
    function cssFromModule(moduleId: string): string;


    /**
     * Returns CSS text of `<styles>` within a given template.
     * 
     * Any `<styles>` processed are removed from their original location.
     */
    function cssFromTemplate(template: HTMLTemplateElement|null, baseURI: string): string;


    /**
     * Returns CSS text from stylesheets loaded via `<link rel="import" type="css">`
     * links within the specified `dom-module`.
     */
    function cssFromModuleImports(moduleId: string): string;

    function _cssFromModuleImports(module: HTMLElement): string;
  }

  /**
   * The `dom-module` element registers the dom it contains to the name given
   * by the module's id attribute. It provides a unified database of dom
   * accessible via its static `import` API.
   * 
   * A key use case of `dom-module` is for providing custom element `<template>`s
   * via HTML imports that are parsed by the native HTML parser, that can be
   * relocated during a bundling pass and still looked up by `id`.
   * 
   * Example:
   * 
   *     <dom-module id="foo">
   *       <img src="stuff.png">
   *     </dom-module>
   * 
   * Then in code in some other location that cannot access the dom-module above
   * 
   *     let img = customElements.get('dom-module').import('foo', 'img');
   */
  interface DomModule extends Polymer.Element {
    attributeChangedCallback(name: any, old: any, value: any): any;

    /**
     * Registers the dom-module at a given id. This method should only be called
     * when a dom-module is imperatively created. For
     * example, `document.createElement('dom-module').register('foo')`.
     */
    register(id: any): any;
  }

  namespace Path {


    /**
     * Returns true if the given string is a structured data path (has dots).
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.isPath('foo.bar.baz') // true
     * Polymer.Path.isPath('foo')         // false
     * ```
     */
    function isPath(path: string): boolean;


    /**
     * Returns the root property name for the given path.
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.root('foo.bar.baz') // 'foo'
     * Polymer.Path.root('foo')         // 'foo'
     * ```
     */
    function root(path: string): string;


    /**
     * Given `base` is `foo.bar`, `foo` is an ancestor, `foo.bar` is not
     * Returns true if the given path is an ancestor of the base path.
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.isAncestor('foo.bar', 'foo')         // true
     * Polymer.Path.isAncestor('foo.bar', 'foo.bar')     // false
     * Polymer.Path.isAncestor('foo.bar', 'foo.bar.baz') // false
     * ```
     */
    function isAncestor(base: string, path: string): boolean;


    /**
     * Given `base` is `foo.bar`, `foo.bar.baz` is an descendant
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.isDescendant('foo.bar', 'foo.bar.baz') // true
     * Polymer.Path.isDescendant('foo.bar', 'foo.bar')     // false
     * Polymer.Path.isDescendant('foo.bar', 'foo')         // false
     * ```
     */
    function isDescendant(base: string, path: string): boolean;


    /**
     * Replaces a previous base path with a new base path, preserving the
     * remainder of the path.
     * 
     * User must ensure `path` has a prefix of `base`.
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.translate('foo.bar', 'zot' 'foo.bar.baz') // 'zot.baz'
     * ```
     */
    function translate(base: string, newBase: string, path: string): string;


    /**
     * Converts array-based paths to flattened path.  String-based paths
     * are returned as-is.
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.normalize(['foo.bar', 0, 'baz'])  // 'foo.bar.0.baz'
     * Polymer.Path.normalize('foo.bar.0.baz')        // 'foo.bar.0.baz'
     * ```
     */
    function normalize(path: (string|(string|number)[])): string;


    /**
     * Splits a path into an array of property names. Accepts either arrays
     * of path parts or strings.
     * 
     * Example:
     * 
     * ```
     * Polymer.Path.split(['foo.bar', 0, 'baz'])  // ['foo', 'bar', '0', 'baz']
     * Polymer.Path.split('foo.bar.0.baz')        // ['foo', 'bar', '0', 'baz']
     * ```
     */
    function split(path: (string|(string|number)[])): string[];


    /**
     * Reads a value from a path.  If any sub-property in the path is `undefined`,
     * this method returns `undefined` (will never throw.
     */
    function get(root: Object|null, path: (string|(string|number)[]), info: any): any;


    /**
     * Sets a value to a path.  If any sub-property in the path is `undefined`,
     * this method will no-op.
     */
    function set(root: Object|null, path: (string|(string|number)[]), value: any): (string|undefined);
  }

  /**
   * Base class that provides the core API for Polymer's meta-programming
   * features including template stamping, data-binding, attribute deserialization,
   * and property change observation.
   */
  interface Element extends Polymer.Element {
  }

  namespace Gestures {


    /**
     * Finds the element rendered on the screen at the provided coordinates.
     * 
     * Similar to `document.elementFromPoint`, but pierces through
     * shadow roots.
     */
    function deepTargetFind(x: number, y: number): Element|null;


    /**
     * Adds an event listener to a node for the given gesture type.
     */
    function addListener(node: Node|null, evType: string, handler: Function|null): boolean;


    /**
     * Removes an event listener from a node for the given gesture type.
     */
    function removeListener(node: Node|null, evType: string, handler: Function|null): boolean;


    /**
     * Registers a new gesture event recognizer for adding new custom
     * gesture event types.
     */
    function register(recog: GestureRecognizer|null): any;


    /**
     * Sets scrolling direction on node.
     * 
     * This value is checked on first move, thus it should be called prior to
     * adding event listeners.
     */
    function setTouchAction(node: Element|null, value: string): any;


    /**
     * Prevents the dispatch and default action of the given event name.
     */
    function prevent(evName: string): any;


    /**
     * Reset the 2500ms timeout on processing mouse input after detecting touch input.
     * 
     * Touch inputs create synthesized mouse inputs anywhere from 0 to 2000ms after the touch.
     * This method should only be called during testing with simulated touch inputs.
     * Calling this method in production may cause duplicate taps or other Gestures.
     */
    function resetMouseCanceller(): any;
  }


  /**
   * Convenience method for importing an HTML document imperatively.
   * 
   * This method creates a new `<link rel="import">` element with
   * the provided URL and appends it to the document to start loading.
   * In the `onload` callback, the `import` property of the `link`
   * element will contain the imported document contents.
   */
  function importHref(href: string, onload: any, onerror: any, optAsync: any): HTMLLinkElement|null;

  namespace RenderStatus {


    /**
     * Enqueues a callback which will be run before the next render, at
     * `requestAnimationFrame` timing.
     * 
     * This method is useful for enqueuing work that requires DOM measurement,
     * since measurement may not be reliable in custom element callbacks before
     * the first render, as well as for batching measurement tasks in general.
     * 
     * Tasks in this queue may be flushed by calling `Polymer.RenderStatus.flush()`.
     */
    function beforeNextRender(context: any, callback: () => any, args: Array|null): any;


    /**
     * Enqueues a callback which will be run after the next render, equivalent
     * to one task (`setTimeout`) after the next `requestAnimationFrame`.
     * 
     * This method is useful for tuning the first-render performance of an
     * element or application by deferring non-critical work until after the
     * first paint.  Typical non-render-critical work may include adding UI
     * event listeners and aria attributes.
     */
    function afterNextRender(context: any, callback: () => any, args: Array|null): any;
  }


  /**
   * Adds a `Polymer.Debouncer` to a list of globally flushable tasks.
   */
  function enqueueDebouncer(debouncer: Polymer.Debouncer|null): any;


  /**
   * Forces several classes of asynchronously queued tasks to flush:
   * - Debouncers added via `enqueueDebouncer`
   * - ShadyDOM distribution
   */
  function flush(): any;

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
  function dom(obj: (Node|Event|null)): (DomApi|null|EventApi|null);


  /**
   * Applies a "legacy" behavior or array of behaviors to the provided class.
   * 
   * Note: this method will automatically also apply the `Polymer.LegacyElementMixin`
   * to ensure that any legacy behaviors can rely on legacy Polymer API on
   * the underlying element.
   */
  function mixinBehaviors(behaviors: (Object|null|Array|null), klass: (HTMLElement|() => any)): () => any;


  /**
   * Generates a class that extends `Polymer.LegacyElement` based on the
   * provided info object.  Metadata objects on the `info` object
   * (`properties`, `observers`, `listeners`, `behaviors`, `is`) are used
   * for Polymer's meta-programming systems, and any functions are copied
   * to the generated class.
   * 
   * Valid "metadata" values are as follows:
   * 
   * `is`: String providing the tag name to register the element under. In
   * addition, if a `dom-module` with the same id exists, the first template
   * in that `dom-module` will be stamped into the shadow root of this element,
   * with support for declarative event listeners (`on-...`), Polymer data
   * bindings (`[[...]]` and `{{...}}`), and id-based node finding into
   * `this.$`.
   * 
   * `properties`: Object describing property-related metadata used by Polymer
   * features (key: property names, value: object containing property metadata).
   * Valid keys in per-property metadata include:
   * - `type` (String|Number|Object|Array|...): Used by
   *   `attributeChangedCallback` to determine how string-based attributes
   *   are deserialized to JavaScript property values.
   * - `notify` (boolean): Causes a change in the property to fire a
   *   non-bubbling event called `<property>-changed`. Elements that have
   *   enabled two-way binding to the property use this event to observe changes.
   * - `readOnly` (boolean): Creates a getter for the property, but no setter.
   *   To set a read-only property, use the private setter method
   *   `_setProperty(property, value)`.
   * - `observer` (string): Observer method name that will be called when
   *   the property changes. The arguments of the method are
   *   `(value, previousValue)`.
   * - `computed` (string): String describing method and dependent properties
   *   for computing the value of this property (e.g. `'computeFoo(bar, zot)'`).
   *   Computed properties are read-only by default and can only be changed
   *   via the return value of the computing method.
   * 
   * `observers`: Array of strings describing multi-property observer methods
   *  and their dependent properties (e.g. `'observeABC(a, b, c)'`).
   * 
   * `listeners`: Object describing event listeners to be added to each
   *  instance of this element (key: event name, value: method name).
   * 
   * `behaviors`: Array of additional `info` objects containing metadata
   * and callbacks in the same format as the `info` object here which are
   * merged into this element.
   * 
   * `hostAttributes`: Object listing attributes to be applied to the host
   *  once created (key: attribute name, value: attribute value).  Values
   *  are serialized based on the type of the value.  Host attributes should
   *  generally be limited to attributes such as `tabIndex` and `aria-...`.
   *  Attributes in `hostAttributes` are only applied if a user-supplied
   *  attribute is not already present (attributes in markup override
   *  `hostAttributes`).
   * 
   * In addition, the following Polymer-specific callbacks may be provided:
   * - `registered`: called after first instance of this element,
   * - `created`: called during `constructor`
   * - `attached`: called during `connectedCallback`
   * - `detached`: called during `disconnectedCallback`
   * - `ready`: called before first `attached`, after all properties of
   *   this element have been propagated to its template and all observers
   *   have run
   */
  function Class(info: PolymerInit): () => any;

  namespace Templatize {


    /**
     * Returns an anonymous `Polymer.PropertyEffects` class bound to the
     * `<template>` provided.  Instancing the class will result in the
     * template being stamped into document fragment stored as the instance's
     * `root` property, after which it can be appended to the DOM.
     * 
     * Templates may utilize all Polymer data-binding features as well as
     * declarative event listeners.  Event listeners and inline computing
     * functions in the template will be called on the host of the template.
     * 
     * The constructor returned takes a single argument dictionary of initial
     * property values to propagate into template bindings.  Additionally
     * host properties can be forwarded in, and instance properties can be
     * notified out by providing optional callbacks in the `options` dictionary.
     * 
     * Valid configuration in `options` are as follows:
     * 
     * - `forwardHostProp(property, value)`: Called when a property referenced
     *   in the template changed on the template's host. As this library does
     *   not retain references to templates instanced by the user, it is the
     *   templatize owner's responsibility to forward host property changes into
     *   user-stamped instances.  The `instance.forwardHostProp(property, value)`
     *    method on the generated class should be called to forward host
     *   properties into the template to prevent unnecessary property-changed
     *   notifications. Any properties referenced in the template that are not
     *   defined in `instanceProps` will be notified up to the template's host
     *   automatically.
     * - `instanceProps`: Dictionary of property names that will be added
     *   to the instance by the templatize owner.  These properties shadow any
     *   host properties, and changes within the template to these properties
     *   will result in `notifyInstanceProp` being called.
     * - `mutableData`: When `true`, the generated class will skip strict
     *   dirty-checking for objects and arrays (always consider them to be
     *   "dirty").
     * - `notifyInstanceProp(instance, property, value)`: Called when
     *   an instance property changes.  Users may choose to call `notifyPath`
     *   on e.g. the owner to notify the change.
     * - `parentModel`: When `true`, events handled by declarative event listeners
     *   (`on-event="handler"`) will be decorated with a `model` property pointing
     *   to the template instance that stamped it.  It will also be returned
     *   from `instance.parentModel` in cases where template instance nesting
     *   causes an inner model to shadow an outer model.
     * 
     * Note that the class returned from `templatize` is generated only once
     * for a given `<template>` using `options` from the first call for that
     * template, and the cached class is returned for all subsequent calls to
     * `templatize` for that template.  As such, `options` callbacks should not
     * close over owner-specific properties since only the first `options` is
     * used; rather, callbacks are called bound to the `owner`, and so context
     * needed from the callbacks (such as references to `instances` stamped)
     * should be stored on the `owner` such that they can be retrieved via `this`.
     */
    function templatize(template: HTMLTemplateElement, owner: Polymer_PropertyEffects, options: any): () => any;


    /**
     * Returns the template "model" associated with a given element, which
     * serves as the binding scope for the template instance the element is
     * contained in. A template model is an instance of
     * `TemplateInstanceBase`, and should be used to manipulate data
     * associated with this template instance.
     * 
     * Example:
     * 
     *   let model = modelForElement(el);
     *   if (model.index < 10) {
     *     model.set('item.checked', true);
     *   }
     */
    function modelForElement(template: HTMLTemplateElement|null, node: Node|null): TemplateInstanceBase|null;
  }

  /**
   * The `Polymer.Templatizer` behavior adds methods to generate instances of
   * templates that are each managed by an anonymous `Polymer.PropertyEffects`
   * instance where data-bindings in the stamped template content are bound to
   * accessors on itself.
   * 
   * This behavior is provided in Polymer 2.x as a hybrid-element convenience
   * only.  For non-hybrid usage, the `Polymer.Templatize` library
   * should be used instead.
   * 
   * Example:
   * 
   *     // Get a template from somewhere, e.g. light DOM
   *     let template = this.querySelector('template');
   *     // Prepare the template
   *     this.templatize(template);
   *     // Instance the template with an initial data model
   *     let instance = this.stamp({myProp: 'initial'});
   *     // Insert the instance's DOM somewhere, e.g. light DOM
   *     Polymer.dom(this).appendChild(instance.root);
   *     // Changing a property on the instance will propagate to bindings
   *     // in the template
   *     instance.myProp = 'new value';
   * 
   * Users of `Templatizer` may need to implement the following abstract
   * API's to determine how properties and paths from the host should be
   * forwarded into to instances:
   * 
   *     _forwardHostPropV2: function(prop, value)
   * 
   * Likewise, users may implement these additional abstract API's to determine
   * how instance-specific properties that change on the instance should be
   * forwarded out to the host, if necessary.
   * 
   *     _notifyInstancePropV2: function(inst, prop, value)
   * 
   * In order to determine which properties are instance-specific and require
   * custom notification via `_notifyInstanceProp`, define an `_instanceProps`
   * object containing keys for each instance prop, for example:
   * 
   *     _instanceProps: {
   *       item: true,
   *       index: true
   *     }
   * 
   * Any properties used in the template that are not defined in _instanceProp
   * will be forwarded out to the Templatize `owner` automatically.
   * 
   * Users may also implement the following abstract function to show or
   * hide any DOM generated using `stamp`:
   * 
   *     _showHideChildren: function(shouldHide)
   * 
   * Note that some callbacks are suffixed with `V2` in the Polymer 2.x behavior
   * as the implementations will need to differ from the callbacks required
   * by the 1.x Templatizer API due to changes in the `TemplateInstance` API
   * between versions 1.x and 2.x.
   */
  interface Templatizer {

    /**
     * Generates an anonymous `TemplateInstance` class (stored as `this.ctor`)
     * for the provided template.  This method should be called once per
     * template to prepare an element for stamping the template, followed
     * by `stamp` to create new instances of the template.
     */
    templatize(template: HTMLTemplateElement|null, mutableData: any): any;

    /**
     * Creates an instance of the template prepared by `templatize`.  The object
     * returned is an instance of the anonymous class generated by `templatize`
     * whose `root` property is a document fragment containing newly cloned
     * template content, and which has property accessors corresponding to
     * properties referenced in template bindings.
     */
    stamp(model: any): TemplateInstanceBase|null;

    /**
     * Returns the template "model" (`TemplateInstance`) associated with
     * a given element, which serves as the binding scope for the template
     * instance the element is contained in.  A template model should be used
     * to manipulate data associated with this template instance.
     */
    modelForElement(el: HTMLElement|null): TemplateInstanceBase|null;
  }

  /**
   * Custom element to allow using Polymer's template features (data binding,
   * declarative event listeners, etc.) in the main document without defining
   * a new custom element.
   * 
   * `<template>` tags utilizing bindings may be wrapped with the `<dom-bind>`
   * element, which will immediately stamp the wrapped template into the main
   * document and bind elements to the `dom-bind` element itself as the
   * binding scope.
   */
  interface DomBind extends Polymer.Element {

    /**
     * assumes only one observed attribute
     */
    attributeChangedCallback(): any;
    connectedCallback(): any;
    disconnectedCallback(): any;
    __insertChildren(): any;
    __removeChildren(): any;

    /**
     * Forces the element to render its content. This is typically only
     * necessary to call if HTMLImports with the async attribute are used.
     */
    render(): any;
  }

  /**
   * The `<dom-repeat>` element will automatically stamp and binds one instance
   * of template content to each object in a user-provided array.
   * `dom-repeat` accepts an `items` property, and one instance of the template
   * is stamped for each item into the DOM at the location of the `dom-repeat`
   * element.  The `item` property will be set on each instance's binding
   * scope, thus templates should bind to sub-properties of `item`.
   * 
   * Example:
   * 
   * ```html
   * <dom-module id="employee-list">
   * 
   *   <template>
   * 
   *     <div> Employee list: </div>
   *     <template is="dom-repeat" items="{{employees}}">
   *         <div>First name: <span>{{item.first}}</span></div>
   *         <div>Last name: <span>{{item.last}}</span></div>
   *     </template>
   * 
   *   </template>
   * 
   *   <script>
   *     Polymer({
   *       is: 'employee-list',
   *       ready: function() {
   *         this.employees = [
   *             {first: 'Bob', last: 'Smith'},
   *             {first: 'Sally', last: 'Johnson'},
   *             ...
   *         ];
   *       }
   *     });
   *   < /script>
   * 
   * </dom-module>
   * ```
   * 
   * Notifications for changes to items sub-properties will be forwarded to template
   * instances, which will update via the normal structured data notification system.
   * 
   * Mutations to the `items` array itself should be made using the Array
   * mutation API's on `Polymer.Base` (`push`, `pop`, `splice`, `shift`,
   * `unshift`), and template instances will be kept in sync with the data in the
   * array.
   * 
   * Events caught by event handlers within the `dom-repeat` template will be
   * decorated with a `model` property, which represents the binding scope for
   * each template instance.  The model is an instance of Polymer.Base, and should
   * be used to manipulate data on the instance, for example
   * `event.model.set('item.checked', true);`.
   * 
   * Alternatively, the model for a template instance for an element stamped by
   * a `dom-repeat` can be obtained using the `modelForElement` API on the
   * `dom-repeat` that stamped it, for example
   * `this.$.domRepeat.modelForElement(event.target).set('item.checked', true);`.
   * This may be useful for manipulating instance data of event targets obtained
   * by event handlers on parents of the `dom-repeat` (event delegation).
   * 
   * A view-specific filter/sort may be applied to each `dom-repeat` by supplying a
   * `filter` and/or `sort` property.  This may be a string that names a function on
   * the host, or a function may be assigned to the property directly.  The functions
   * should implemented following the standard `Array` filter/sort API.
   * 
   * In order to re-run the filter or sort functions based on changes to sub-fields
   * of `items`, the `observe` property may be set as a space-separated list of
   * `item` sub-fields that should cause a re-filter/sort when modified.  If
   * the filter or sort function depends on properties not contained in `items`,
   * the user should observe changes to those properties and call `render` to update
   * the view based on the dependency change.
   * 
   * For example, for an `dom-repeat` with a filter of the following:
   * 
   * ```js
   * isEngineer: function(item) {
   *     return item.type == 'engineer' || item.manager.type == 'engineer';
   * }
   * ```
   * 
   * Then the `observe` property should be configured as follows:
   * 
   * ```html
   * <template is="dom-repeat" items="{{employees}}"
   *           filter="isEngineer" observe="type manager.type">
   * ```
   */
  interface DomRepeat extends Polymer.Element {

    /**
     * An array containing items determining how many instances of the template
     * to stamp and that that each template instance should bind to.
     */
    items: Array|null;

    /**
     * The name of the variable to add to the binding scope for the array
     * element associated with a given template instance.
     */
    as: string;

    /**
     * The name of the variable to add to the binding scope with the index
     * of the instance in the sorted and filtered list of rendered items.
     * Note, for the index in the `this.items` array, use the value of the
     * `itemsIndexAs` property.
     */
    indexAs: string;

    /**
     * The name of the variable to add to the binding scope with the index
     * of the instance in the `this.items` array. Note, for the index of
     * this instance in the sorted and filtered list of rendered items,
     * use the value of the `indexAs` property.
     */
    itemsIndexAs: string;

    /**
     * A function that should determine the sort order of the items.  This
     * property should either be provided as a string, indicating a method
     * name on the element's host, or else be an actual function.  The
     * function should match the sort function passed to `Array.sort`.
     * Using a sort function has no effect on the underlying `items` array.
     */
    sort: Function|null;

    /**
     * A function that can be used to filter items out of the view.  This
     * property should either be provided as a string, indicating a method
     * name on the element's host, or else be an actual function.  The
     * function should match the sort function passed to `Array.filter`.
     * Using a filter function has no effect on the underlying `items` array.
     */
    filter: Function|null;

    /**
     * When using a `filter` or `sort` function, the `observe` property
     * should be set to a space-separated list of the names of item
     * sub-fields that should trigger a re-sort or re-filter when changed.
     * These should generally be fields of `item` that the sort or filter
     * function depends on.
     */
    observe: string;

    /**
     * When using a `filter` or `sort` function, the `delay` property
     * determines a debounce time after a change to observed item
     * properties that must pass before the filter or sort is re-run.
     * This is useful in rate-limiting shuffling of the view when
     * item changes may be frequent.
     */
    delay: number;

    /**
     * Count of currently rendered items after `filter` (if any) has been applied.
     * If "chunking mode" is enabled, `renderedItemCount` is updated each time a
     * set of template instances is rendered.
     */
    renderedItemCount: number;

    /**
     * Defines an initial count of template instances to render after setting
     * the `items` array, before the next paint, and puts the `dom-repeat`
     * into "chunking mode".  The remaining items will be created and rendered
     * incrementally at each animation frame therof until all instances have
     * been rendered.
     */
    initialCount: number;

    /**
     * When `initialCount` is used, this property defines a frame rate to
     * target by throttling the number of instances rendered each frame to
     * not exceed the budget for the target frame rate.  Setting this to a
     * higher number will allow lower latency and higher throughput for
     * things like event handlers, but will result in a longer time for the
     * remaining items to complete rendering.
     */
    targetFramerate: number;
    _targetFrameTime: number;
    disconnectedCallback(): any;
    connectedCallback(): any;
    __ensureTemplatized(): any;
    __getMethodHost(): any;
    __sortChanged(sort: any): any;
    __filterChanged(filter: any): any;
    __computeFrameTime(rate: any): any;
    __initializeChunking(): any;
    __tryRenderChunk(): any;
    __requestRenderChunk(): any;
    __renderChunk(): any;
    __observeChanged(): any;
    __itemsChanged(change: any): any;
    __handleObservedPaths(path: any): any;
    __debounceRender(fn: () => any, delay = 0: any): any;

    /**
     * Forces the element to render its content. Normally rendering is
     * asynchronous to a provoking change. This is done for efficiency so
     * that multiple changes trigger only a single render. The render method
     * should be called if, for example, template rendering is required to
     * validate application state.
     */
    render(): any;
    __render(): any;
    __applyFullRefresh(): any;
    __detachInstance(idx: any): any;
    __attachInstance(idx: any, parent: any): any;
    __detachAndRemoveInstance(idx: any): any;
    __stampInstance(item: any, instIdx: any, itemIdx: any): any;
    __insertInstance(item: any, instIdx: any, itemIdx: any): any;

    /**
     * Implements extension point from Templatize mixin
     */
    _showHideChildren(hidden: any): any;

    /**
     * responsible for notifying item.<path> changes to inst for key
     */
    __handleItemPath(path: any, value: any): any;

    /**
     * Returns the item associated with a given element stamped by
     * this `dom-repeat`.
     * 
     * Note, to modify sub-properties of the item,
     * `modelForElement(el).set('item.<sub-prop>', value)`
     * should be used.
     */
    itemForElement(el: HTMLElement|null): any;

    /**
     * Returns the inst index for a given element stamped by this `dom-repeat`.
     * If `sort` is provided, the index will reflect the sorted order (rather
     * than the original array order).
     */
    indexForElement(el: HTMLElement|null): any;

    /**
     * Returns the template "model" associated with a given element, which
     * serves as the binding scope for the template instance the element is
     * contained in. A template model is an instance of `Polymer.Base`, and
     * should be used to manipulate data associated with this template instance.
     * 
     * Example:
     * 
     *   let model = modelForElement(el);
     *   if (model.index < 10) {
     *     model.set('item.checked', true);
     *   }
     */
    modelForElement(el: HTMLElement|null): TemplateInstanceBase|null;
  }

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
  interface DomIf extends Polymer.Element {

    /**
     * A boolean indicating whether this template should stamp.
     */
    if: boolean;

    /**
     * When true, elements will be removed from DOM and discarded when `if`
     * becomes false and re-created and added back to the DOM when `if`
     * becomes true.  By default, stamped elements will be hidden but left
     * in the DOM when `if` becomes false, which is generally results
     * in better performance.
     */
    restamp: boolean;
    connectedCallback(): any;
    disconnectedCallback(): any;
    __debounceRender(): any;

    /**
     * Forces the element to render its content. Normally rendering is
     * asynchronous to a provoking change. This is done for efficiency so
     * that multiple changes trigger only a single render. The render method
     * should be called if, for example, template rendering is required to
     * validate application state.
     */
    render(): any;
    __render(): any;
    __ensureInstance(): any;
    __syncHostProperties(): any;
    __teardownInstance(): any;
    _showHideChildren(): any;
  }

  /**
   * Element implementing the `Polymer.ArraySelector` mixin, which records
   * dynamic associations between item paths in a master `items` array and a
   * `selected` array such that path changes to the master array (at the host)
   * element or elsewhere via data-binding) are correctly propagated to items
   * in the selected array and vice-versa.
   * 
   * The `items` property accepts an array of user data, and via the
   * `select(item)` and `deselect(item)` API, updates the `selected` property
   * which may be bound to other parts of the application, and any changes to
   * sub-fields of `selected` item(s) will be kept in sync with items in the
   * `items` array.  When `multi` is false, `selected` is a property
   * representing the last selected item.  When `multi` is true, `selected`
   * is an array of multiply selected items.
   * 
   * Example:
   * 
   * ```html
   * <dom-module id="employee-list">
   * 
   *   <template>
   * 
   *     <div> Employee list: </div>
   *     <template is="dom-repeat" id="employeeList" items="{{employees}}">
   *         <div>First name: <span>{{item.first}}</span></div>
   *         <div>Last name: <span>{{item.last}}</span></div>
   *         <button on-click="toggleSelection">Select</button>
   *     </template>
   * 
   *     <array-selector id="selector" items="{{employees}}" selected="{{selected}}" multi toggle></array-selector>
   * 
   *     <div> Selected employees: </div>
   *     <template is="dom-repeat" items="{{selected}}">
   *         <div>First name: <span>{{item.first}}</span></div>
   *         <div>Last name: <span>{{item.last}}</span></div>
   *     </template>
   * 
   *   </template>
   * 
   * </dom-module>
   * ```
   * 
   * ```js
   * Polymer({
   *   is: 'employee-list',
   *   ready() {
   *     this.employees = [
   *         {first: 'Bob', last: 'Smith'},
   *         {first: 'Sally', last: 'Johnson'},
   *         ...
   *     ];
   *   },
   *   toggleSelection(e) {
   *     let item = this.$.employeeList.itemForElement(e.target);
   *     this.$.selector.select(item);
   *   }
   * });
   * ```
   */
  interface ArraySelector extends Polymer.Element {
  }

  /**
   * Custom element for defining styles in the main document that can take
   * advantage of [shady DOM](https://github.com/webcomponents/shadycss) shims
   * for style encapsulation, custom properties, and custom mixins.
   * 
   * - Document styles defined in a `<custom-style>` are shimmed to ensure they
   *   do not leak into local DOM when running on browsers without native
   *   Shadow DOM.
   * - Custom properties can be defined in a `<custom-style>`. Use the `html` selector
   *   to define custom properties that apply to all custom elements.
   * - Custom mixins can be defined in a `<custom-style>`, if you import the optional
   *   [apply shim](https://github.com/webcomponents/shadycss#about-applyshim)
   *   (`shadycss/apply-shim.html`).
   * 
   * To use:
   * 
   * - Import `custom-style.html`.
   * - Place a `<custom-style>` element in the main document, wrapping an inline `<style>` tag that
   *   contains the CSS rules you want to shim.
   * 
   * For example:
   * 
   * ```
   * <!-- import apply shim--only required if using mixins -->
   * <link rel="import href="bower_components/shadycss/apply-shim.html">
   * <!-- import custom-style element -->
   * <link rel="import" href="bower_components/polymer/lib/elements/custom-style.html">
   * ...
   * <custom-style>
   *   <style>
   *     html {
   *       --custom-color: blue;
   *       --custom-mixin: {
   *         font-weight: bold;
   *         color: red;
   *       };
   *     }
   *   </style>
   * </custom-style>
   * ```
   */
  interface CustomStyle extends Polymer.Element {

    /**
     * Returns the light-DOM `<style>` child this element wraps.  Upon first
     * call any style modules referenced via the `include` attribute will be
     * concatenated to this element's `<style>`.
     */
    getStyle(): HTMLStyleElement|null;
  }

  /**
   * Legacy element behavior to skip strict dirty-checking for objects and arrays,
   * (always consider them to be "dirty") for use on legacy API Polymer elements.
   * 
   * By default, `Polymer.PropertyEffects` performs strict dirty checking on
   * objects, which means that any deep modifications to an object or array will
   * not be propagated unless "immutable" data patterns are used (i.e. all object
   * references from the root to the mutation were changed).
   * 
   * Polymer also provides a proprietary data mutation and path notification API
   * (e.g. `notifyPath`, `set`, and array mutation API's) that allow efficient
   * mutation and notification of deep changes in an object graph to all elements
   * bound to the same object graph.
   * 
   * In cases where neither immutable patterns nor the data mutation API can be
   * used, applying this mixin will cause Polymer to skip dirty checking for
   * objects and arrays (always consider them to be "dirty").  This allows a
   * user to make a deep modification to a bound object graph, and then either
   * simply re-set the object (e.g. `this.items = this.items`) or call `notifyPath`
   * (e.g. `this.notifyPath('items')`) to update the tree.  Note that all
   * elements that wish to be updated based on deep mutations must apply this
   * mixin or otherwise skip strict dirty checking for objects/arrays.
   * 
   * In order to make the dirty check strategy configurable, see
   * `Polymer.OptionalMutableDataBehavior`.
   * 
   * Note, the performance characteristics of propagating large object graphs
   * will be worse as opposed to using strict dirty checking with immutable
   * patterns or Polymer's path notification API.
   */
  interface MutableDataBehavior {

    /**
     * Overrides `Polymer.PropertyEffects` to provide option for skipping
     * strict equality checking for Objects and Arrays.
     * 
     * This method pulls the value to dirty check against from the `__dataTemp`
     * cache (rather than the normal `__data` cache) for Objects.  Since the temp
     * cache is cleared at the end of a turn, this implementation allows
     * side-effects of deep object changes to be processed by re-setting the
     * same object (using the temp cache as an in-turn backstop to prevent
     * cycles due to 2-way notification).
     */
    _shouldPropertyChange(property: string, value: any, old: any): boolean;
  }

  /**
   * Legacy element behavior to add the optional ability to skip strict
   * dirty-checking for objects and arrays (always consider them to be
   * "dirty") by setting a `mutable-data` attribute on an element instance.
   * 
   * By default, `Polymer.PropertyEffects` performs strict dirty checking on
   * objects, which means that any deep modifications to an object or array will
   * not be propagated unless "immutable" data patterns are used (i.e. all object
   * references from the root to the mutation were changed).
   * 
   * Polymer also provides a proprietary data mutation and path notification API
   * (e.g. `notifyPath`, `set`, and array mutation API's) that allow efficient
   * mutation and notification of deep changes in an object graph to all elements
   * bound to the same object graph.
   * 
   * In cases where neither immutable patterns nor the data mutation API can be
   * used, applying this mixin will allow Polymer to skip dirty checking for
   * objects and arrays (always consider them to be "dirty").  This allows a
   * user to make a deep modification to a bound object graph, and then either
   * simply re-set the object (e.g. `this.items = this.items`) or call `notifyPath`
   * (e.g. `this.notifyPath('items')`) to update the tree.  Note that all
   * elements that wish to be updated based on deep mutations must apply this
   * mixin or otherwise skip strict dirty checking for objects/arrays.
   * 
   * While this behavior adds the ability to forgo Object/Array dirty checking,
   * the `mutableData` flag defaults to false and must be set on the instance.
   * 
   * Note, the performance characteristics of propagating large object graphs
   * will be worse by relying on `mutableData: true` as opposed to using
   * strict dirty checking with immutable patterns or Polymer's path notification
   * API.
   */
  interface OptionalMutableDataBehavior {

    /**
     * Instance-level flag for configuring the dirty-checking strategy
     * for this element.  When true, Objects and Arrays will skip dirty
     * checking, otherwise strict equality checking will be used.
     */
    mutableData: boolean;

    /**
     * Overrides `Polymer.PropertyEffects` to skip strict equality checking
     * for Objects and Arrays.
     * 
     * Pulls the value to dirty check against from the `__dataTemp` cache
     * (rather than the normal `__data` cache) for Objects.  Since the temp
     * cache is cleared at the end of a turn, this implementation allows
     * side-effects of deep object changes to be processed by re-setting the
     * same object (using the temp cache as an in-turn backstop to prevent
     * cycles due to 2-way notification).
     */
    _shouldPropertyChange(property: string, value: any, old: any): boolean;
  }
}

interface TemplateInstanceBase extends Polymer.Element {
  _addEventListenerToNode(node: any, eventName: any, handler: any): any;

  /**
   * Overrides default property-effects implementation to intercept
   * textContent bindings while children are "hidden" and cache in
   * private storage for later retrieval.
   */
  _setUnmanagedPropertyToNode(node: any, prop: any, value: any): any;

  /**
   * Configure the given `props` by calling `_setPendingProperty`. Also
   * sets any properties stored in `__hostProps`.
   */
  _configureProperties(props: Object|null): any;

  /**
   * Forwards a host property to this instance.  This method should be
   * called on instances from the `options.forwardHostProp` callback
   * to propagate changes of host properties to each instance.
   * 
   * Note this method enqueues the change, which are flushed as a batch.
   */
  forwardHostProp(prop: string, value: any): any;

  /**
   * Shows or hides the template instance top level child elements. For
   * text nodes, `textContent` is removed while "hidden" and replaced when
   * "shown."
   */
  _showHideChildren(hide: boolean): any;
}
