/// <reference path="../utils/boot.d.ts" />
/// <reference path="../utils/mixin.d.ts" />
/// <reference path="../utils/path.d.ts" />
/// <reference path="../utils/case-map.d.ts" />
/// <reference path="property-accessors.d.ts" />
/// <reference path="template-stamp.d.ts" />

declare namespace Polymer {

  /**
   * Element class mixin that provides meta-programming for Polymer's template
   * binding and data observation (collectively, "property effects") system.
   * 
   * This mixin uses provides the following key static methods for adding
   * property effects to an element class:
   * - `addPropertyEffect`
   * - `createPropertyObserver`
   * - `createMethodObserver`
   * - `createNotifyingProperty`
   * - `createReadOnlyProperty`
   * - `createReflectedProperty`
   * - `createComputedProperty`
   * - `bindTemplate`
   * 
   * Each method creates one or more property accessors, along with metadata
   * used by this mixin's implementation of `_propertiesChanged` to perform
   * the property effects.
   * 
   * Underscored versions of the above methods also exist on the element
   * prototype for adding property effects on instances at runtime.
   * 
   * Note that this mixin overrides several `PropertyAccessors` methods, in
   * many cases to maintain guarantees provided by the Polymer 1.x features;
   * notably it changes property accessors to be synchronous by default
   * whereas the default when using `PropertyAccessors` standalone is to be
   * async by default.
   */
  function PropertyEffects<T extends new(...args: any[]) => {}>(base: T): {
    new(...args: any[]): {
      __dataCounter: number;
      __data: Object;
      __dataPending: Object;
      __dataOld: Object;
      __dataClientsReady: boolean;
      __dataPendingClients: any[]|null;
      __dataToNotify: Object|null;
      __dataLinkedPaths: Object|null;
      __dataHasPaths: boolean;
      __dataCompoundStorage: Object|null;
      __dataHost: Polymer_PropertyEffects|null;
      __dataTemp: Object;
      __dataClientsInitialized: boolean;
      __computeEffects: Object|null;
      __reflectEffects: Object|null;
      __notifyEffects: Object|null;
      __propagateEffects: Object|null;
      __observeEffects: Object|null;
      __readOnly: Object|null;
      __templateInfo: TemplateInfo;

      /**
       * Stamps the provided template and performs instance-time setup for
       * Polymer template features, including data bindings, declarative event
       * listeners, and the `this.$` map of `id`'s to nodes.  A document fragment
       * is returned containing the stamped DOM, ready for insertion into the
       * DOM.
       * 
       * This method may be called more than once; however note that due to
       * `shadycss` polyfill limitations, only styles from templates prepared
       * using `ShadyCSS.prepareTemplate` will be correctly polyfilled (scoped
       * to the shadow root and support CSS custom properties), and note that
       * `ShadyCSS.prepareTemplate` may only be called once per element. As such,
       * any styles required by in runtime-stamped templates must be included
       * in the main element template.
       */
      _stampTemplate(template: HTMLTemplateElement): StampedTemplate;
      _initializeProperties(): any;

      /**
       * Overrides `Polymer.PropertyAccessors` implementation to provide a
       * more efficient implementation of initializing properties from
       * the prototype on the instance.
       */
      _initializeProtoProperties(props: Object|null): any;

      /**
       * Overrides `Polymer.PropertyAccessors` implementation to avoid setting
       * `_setProperty`'s `shouldNotify: true`.
       */
      _initializeInstanceProperties(props: Object|null): any;

      /**
       * Overrides base implementation to ensure all accessors set `shouldNotify`
       * to true, for per-property notification tracking.
       */
      _setProperty(property: any, value: any): any;

      /**
       * Overrides the `PropertyAccessors` implementation to introduce special
       * dirty check logic depending on the property & value being set:
       * 
       * 1. Any value set to a path (e.g. 'obj.prop': 42 or 'obj.prop': {...})
       *    Stored in `__dataTemp`, dirty checked against `__dataTemp`
       * 2. Object set to simple property (e.g. 'prop': {...})
       *    Stored in `__dataTemp` and `__data`, dirty checked against
       *    `__dataTemp` by default implementation of `_shouldPropertyChange`
       * 3. Primitive value set to simple property (e.g. 'prop': 42)
       *    Stored in `__data`, dirty checked against `__data`
       * 
       * The dirty-check is important to prevent cycles due to two-way
       * notification, but paths and objects are only dirty checked against any
       * previous value set during this turn via a "temporary cache" that is
       * cleared when the last `_propertiesChanged` exits. This is so:
       * a. any cached array paths (e.g. 'array.3.prop') may be invalidated
       *    due to array mutations like shift/unshift/splice; this is fine
       *    since path changes are dirty-checked at user entry points like `set`
       * b. dirty-checking for objects only lasts one turn to allow the user
       *    to mutate the object in-place and re-set it with the same identity
       *    and have all sub-properties re-propagated in a subsequent turn.
       * 
       * The temp cache is not necessarily sufficient to prevent invalid array
       * paths, since a splice can happen during the same turn (with pathological
       * user code); we could introduce a "fixup" for temporarily cached array
       * paths if needed: https://github.com/Polymer/polymer/issues/4227
       */
      _setPendingProperty(property: string, value: any, shouldNotify?: boolean): boolean;

      /**
       * Overrides `PropertyAccessor`'s default async queuing of
       * `_propertiesChanged`: if `__dataReady` is false (has not yet been
       * manually flushed), the function no-ops; otherwise flushes
       * `_propertiesChanged` synchronously.
       */
      _invalidateProperties(): any;

      /**
       * Overrides `PropertyAccessors` so that property accessor
       * side effects are not enabled until after client dom is fully ready.
       * Also calls `_flushClients` callback to ensure client dom is enabled
       * that was not enabled as a result of flushing properties.
       */
      ready(): any;

      /**
       * Implements `PropertyAccessors`'s properties changed callback.
       * 
       * Runs each class of effects for the batch of changed properties in
       * a specific order (compute, propagate, reflect, observe, notify).
       */
      _propertiesChanged(currentProps: any, changedProps: any, oldProps: any): any;

      /**
       * Equivalent to static `addPropertyEffect` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _addPropertyEffect(property: string, type: string, effect?: Object|null): any;

      /**
       * Removes the given property effect.
       */
      _removePropertyEffect(property: string, type: string, effect?: Object|null): any;

      /**
       * Returns whether the current prototype/instance has a property effect
       * of a certain type.
       */
      _hasPropertyEffect(property: string, type?: string): boolean;

      /**
       * Returns whether the current prototype/instance has a "read only"
       * accessor for the given property.
       */
      _hasReadOnlyEffect(property: string): boolean;

      /**
       * Returns whether the current prototype/instance has a "notify"
       * property effect for the given property.
       */
      _hasNotifyEffect(property: string): boolean;

      /**
       * Returns whether the current prototype/instance has a "reflect to attribute"
       * property effect for the given property.
       */
      _hasReflectEffect(property: string): boolean;

      /**
       * Returns whether the current prototype/instance has a "computed"
       * property effect for the given property.
       */
      _hasComputedEffect(property: string): boolean;

      /**
       * Sets a pending property or path.  If the root property of the path in
       * question had no accessor, the path is set, otherwise it is enqueued
       * via `_setPendingProperty`.
       * 
       * This function isolates relatively expensive functionality necessary
       * for the public API (`set`, `setProperties`, `notifyPath`, and property
       * change listeners via {{...}} bindings), such that it is only done
       * when paths enter the system, and not at every propagation step.  It
       * also sets a `__dataHasPaths` flag on the instance which is used to
       * fast-path slower path-matching code in the property effects host paths.
       * 
       * `path` can be a path string or array of path parts as accepted by the
       * public API.
       */
      _setPendingPropertyOrPath(path: string|Array<number|string>, value: any, shouldNotify?: boolean, isPathNotification?: boolean): boolean;

      /**
       * Applies a value to a non-Polymer element/node's property.
       * 
       * The implementation makes a best-effort at binding interop:
       * Some native element properties have side-effects when
       * re-setting the same value (e.g. setting `<input>.value` resets the
       * cursor position), so we do a dirty-check before setting the value.
       * However, for better interop with non-Polymer custom elements that
       * accept objects, we explicitly re-set object changes coming from the
       * Polymer world (which may include deep object changes without the
       * top reference changing), erring on the side of providing more
       * information.
       * 
       * Users may override this method to provide alternate approaches.
       */
      _setUnmanagedPropertyToNode(node: Node|null, prop: string, value: any): any;

      /**
       * Enqueues the given client on a list of pending clients, whose
       * pending property changes can later be flushed via a call to
       * `_flushClients`.
       */
      _enqueueClient(client: Object|null): any;

      /**
       * Flushes any clients previously enqueued via `_enqueueClient`, causing
       * their `_flushProperties` method to run.
       */
      _flushClients(): any;

      /**
       * (c) the stamped dom enables.
       */
      __enableOrFlushClients(): any;

      /**
       * Perform any initial setup on client dom. Called before the first
       * `_flushProperties` call on client dom and before any element
       * observers are called.
       */
      _readyClients(): any;

      /**
       * Sets a bag of property changes to this instance, and
       * synchronously processes all effects of the properties as a batch.
       * 
       * Property names must be simple properties, not paths.  Batched
       * path propagation is not supported.
       */
      setProperties(props: Object|null, setReadOnly?: boolean): any;

      /**
       * Called to propagate any property changes to stamped template nodes
       * managed by this element.
       */
      _propagatePropertyChanges(changedProps: Object|null, oldProps: Object|null, hasPaths: boolean): any;

      /**
       * Aliases one data path as another, such that path notifications from one
       * are routed to the other.
       */
      linkPaths(to: string|Array<string|number>, from: string|Array<string|number>): any;

      /**
       * Removes a data path alias previously established with `_linkPaths`.
       * 
       * Note, the path to unlink should be the target (`to`) used when
       * linking the paths.
       */
      unlinkPaths(path: string|Array<string|number>): any;

      /**
       * Notify that an array has changed.
       * 
       * Example:
       * 
       *     this.items = [ {name: 'Jim'}, {name: 'Todd'}, {name: 'Bill'} ];
       *     ...
       *     this.items.splice(1, 1, {name: 'Sam'});
       *     this.items.push({name: 'Bob'});
       *     this.notifySplices('items', [
       *       { index: 1, removed: [{name: 'Todd'}], addedCount: 1, object: this.items, type: 'splice' },
       *       { index: 3, removed: [], addedCount: 1, object: this.items, type: 'splice'}
       *     ]);
       */
      notifySplices(path: string, splices: any[]|null): any;

      /**
       * Convenience method for reading a value from a path.
       * 
       * Note, if any part in the path is undefined, this method returns
       * `undefined` (this method does not throw when dereferencing undefined
       * paths).
       */
      get(path: string|Array<string|number>, root?: Object|null): any;

      /**
       * Convenience method for setting a value to a path and notifying any
       * elements bound to the same path.
       * 
       * Note, if any part in the path except for the last is undefined,
       * this method does nothing (this method does not throw when
       * dereferencing undefined paths).
       */
      set(path: string|Array<string|number>, value: any, root?: Object|null): any;

      /**
       * Adds items onto the end of the array at the path specified.
       * 
       * The arguments after `path` and return value match that of
       * `Array.prototype.push`.
       * 
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       */
      push(path: string|Array<string|number>, ...items: any): number;

      /**
       * Removes an item from the end of array at the path specified.
       * 
       * The arguments after `path` and return value match that of
       * `Array.prototype.pop`.
       * 
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       */
      pop(path: string|Array<string|number>): any;

      /**
       * Starting from the start index specified, removes 0 or more items
       * from the array and inserts 0 or more new items in their place.
       * 
       * The arguments after `path` and return value match that of
       * `Array.prototype.splice`.
       * 
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       */
      splice(path: string|Array<string|number>, start: number, deleteCount: number, ...items: any): any[]|null;

      /**
       * Removes an item from the beginning of array at the path specified.
       * 
       * The arguments after `path` and return value match that of
       * `Array.prototype.pop`.
       * 
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       */
      shift(path: string|Array<string|number>): any;

      /**
       * Adds items onto the beginning of the array at the path specified.
       * 
       * The arguments after `path` and return value match that of
       * `Array.prototype.push`.
       * 
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       */
      unshift(path: string|Array<string|number>, ...items: any): number;

      /**
       * Notify that a path has changed.
       * 
       * Example:
       * 
       *     this.item.user.name = 'Bob';
       *     this.notifyPath('item.user.name');
       */
      notifyPath(path: string, value?: any): any;

      /**
       * Equivalent to static `createReadOnlyProperty` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createReadOnlyProperty(property: string, protectedSetter?: boolean): any;

      /**
       * Equivalent to static `createPropertyObserver` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createPropertyObserver(property: string, methodName: string, dynamicFn?: boolean): any;

      /**
       * Equivalent to static `createMethodObserver` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createMethodObserver(expression: string, dynamicFn?: boolean|Object|null): any;

      /**
       * Equivalent to static `createNotifyingProperty` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createNotifyingProperty(property: string): any;

      /**
       * Equivalent to static `createReflectedProperty` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createReflectedProperty(property: string): any;

      /**
       * Equivalent to static `createComputedProperty` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       */
      _createComputedProperty(property: string, expression: string, dynamicFn?: boolean|Object|null): any;

      /**
       * Equivalent to static `bindTemplate` API but can be called on
       * an instance to add effects at runtime.  See that method for
       * full API docs.
       * 
       * This method may be called on the prototype (for prototypical template
       * binding, to avoid creating accessors every instance) once per prototype,
       * and will be called with `runtimeBinding: true` by `_stampTemplate` to
       * create and link an instance of the template metadata associated with a
       * particular stamping.
       */
      _bindTemplate(template: HTMLTemplateElement|null, instanceBinding?: boolean): TemplateInfo;

      /**
       * Removes and unbinds the nodes previously contained in the provided
       * DocumentFragment returned from `_stampTemplate`.
       */
      _removeBoundDom(dom: StampedTemplate): any;
    }
  } & T
}
