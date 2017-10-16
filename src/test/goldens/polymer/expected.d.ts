declare namespace Polymer {
  type Constructor<T> = new(...args: any[]) => T;

  Polymer.dedupingMixin(mixin: T): any;

  interface PropertyAccessors {
    attributeChangedCallback(name: string, old: ?string|null, value: ?string|null): any;
    _initializeProperties(): any;
    _initializeProtoProperties(props: Object): any;
    _initializeInstanceProperties(props: Object): any;
    _ensureAttribute(attribute: string, value: string): any;
    _attributeToProperty(attribute: string, value: ?string|null, type?: any): any;
    _propertyToAttribute(property: string, attribute?: string, value?: any): any;
    _valueToNodeAttribute(node: Element, value: any, attribute: string): any;
    _serializeValue(value: any): (string|undefined);
    _deserializeValue(value: ?string|null, type?: any): any;
    _createPropertyAccessor(property: string, readOnly?: boolean): any;
    _hasAccessor(property: string): boolean;
    _setProperty(property: string, value: any): any;
    _setPendingProperty(property: string, value: any): boolean;
    _isPropertyPending(prop: string): boolean;
    _invalidateProperties(): any;
    _enableProperties(): any;
    _flushProperties(): any;
    ready(): any;
    _propertiesChanged(currentProps: !Object, changedProps: !Object, oldProps: !Object): any;
    _shouldPropertyChange(property: string, value: any, old: any): boolean;
  }
  const PropertyAccessors: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<PropertyAccessors>;

  Polymer.setRootPath(path: string): any;

  Polymer.setSanitizeDOMValue(newSanitizeDOMValue: ((function (*, string, string, Node): *)|undefined)): any;

  Polymer.setPassiveTouchGestures(usePassive: boolean): any;

  class DomModule extends HTMLElement {
    attributeChangedCallback(name: any, old: any, value: any): any;
    register(id?: string): any;
  }

  interface TemplateStamp {
    _stampTemplate(template: !HTMLTemplateElement): !StampedTemplate;
    _addMethodEventListenerToNode(node: Node, eventName: string, methodName: string, context?: any): Function;
    _addEventListenerToNode(node: Node, eventName: string, handler: Function): any;
    _removeEventListenerFromNode(node: Node, eventName: string, handler: Function): any;
  }
  const TemplateStamp: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<TemplateStamp>;

  interface PropertyEffects extends TemplateStamp, PropertyAccessors{
    _stampTemplate(template: !HTMLTemplateElement): !StampedTemplate;
    _initializeProperties(): any;
    _initializeProtoProperties(props: Object): any;
    _initializeInstanceProperties(props: Object): any;
    _setProperty(property: any, value: any): any;
    _setPendingProperty(property: string, value: any, shouldNotify?: boolean): boolean;
    _invalidateProperties(): any;
    ready(): any;
    _propertiesChanged(currentProps: any, changedProps: any, oldProps: any): any;
    _addPropertyEffect(property: string, type: string, effect?: Object): any;
    _removePropertyEffect(property: string, type: string, effect?: Object): any;
    _hasPropertyEffect(property: string, type?: string): boolean;
    _hasReadOnlyEffect(property: string): boolean;
    _hasNotifyEffect(property: string): boolean;
    _hasReflectEffect(property: string): boolean;
    _hasComputedEffect(property: string): boolean;
    _setPendingPropertyOrPath(path: (string|!Array.<(number|string)>), value: any, shouldNotify?: boolean, isPathNotification?: boolean): boolean;
    _setUnmanagedPropertyToNode(node: Node, prop: string, value: any): any;
    _enqueueClient(client: Object): any;
    _flushClients(): any;
    _readyClients(): any;
    setProperties(props: Object, setReadOnly?: boolean): any;
    _propagatePropertyChanges(changedProps: Object, oldProps: Object, hasPaths: boolean): any;
    linkPaths(to: (string|!Array.<(string|number)>), from: (string|!Array.<(string|number)>)): any;
    unlinkPaths(path: (string|!Array.<(string|number)>)): any;
    notifySplices(path: string, splices: any[]): any;
    get(path: (string|!Array.<(string|number)>), root?: Object): any;
    set(path: (string|!Array.<(string|number)>), value: any, root?: Object): any;
    push(path: (string|!Array.<(string|number)>), ...items: any): number;
    pop(path: (string|!Array.<(string|number)>)): any;
    splice(path: (string|!Array.<(string|number)>), start: number, deleteCount: number, ...items: any): any[];
    shift(path: (string|!Array.<(string|number)>)): any;
    unshift(path: (string|!Array.<(string|number)>), ...items: any): number;
    notifyPath(path: string, value?: any): any;
    _createReadOnlyProperty(property: string, protectedSetter?: boolean): any;
    _createPropertyObserver(property: string, methodName: string, dynamicFn?: boolean): any;
    _createMethodObserver(expression: string, dynamicFn?: (boolean|Object)): any;
    _createNotifyingProperty(property: string): any;
    _createReflectedProperty(property: string): any;
    _createComputedProperty(property: string, expression: string, dynamicFn?: (boolean|Object)): any;
    _bindTemplate(template: HTMLTemplateElement, instanceBinding?: boolean): !TemplateInfo;
    _removeBoundDom(dom: !StampedTemplate): any;
  }
  const PropertyEffects: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<PropertyEffects>;

  interface ElementMixin extends PropertyEffects{
    _template: [object Object];
    _importPath: [object Object];
    rootPath: [object Object];
    importPath: [object Object];
    root: [object Object];
    $: [object Object];
    attributeChangedCallback(name: string, old: ?string|null, value: ?string|null): any;
    _initializeProperties(): any;
    ready(): any;
    _readyClients(): any;
    connectedCallback(): any;
    disconnectedCallback(): any;
    _attachDom(dom: StampedTemplate): ShadowRoot;
    updateStyles(properties?: Object): any;
    resolveUrl(url: string, base?: string): string;
  }
  const ElementMixin: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<ElementMixin>;

  class Element {
  }

  interface GestureEventListeners {
    _addEventListenerToNode(node: any, eventName: any, handler: any): any;
    _removeEventListenerFromNode(node: any, eventName: any, handler: any): any;
  }
  const GestureEventListeners: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<GestureEventListeners>;

  Polymer.importHref(href: string, onload?: Function, onerror?: Function, optAsync?: boolean): HTMLLinkElement;

  Polymer.enqueueDebouncer(debouncer: Polymer.Debouncer): any;

  Polymer.flush(): any;

  Polymer.dom(obj: (!Node|Event)): (DomApi|EventApi);

  interface LegacyElementMixin extends ElementMixin, GestureEventListeners{
    isAttached: [object Object];
    _debouncers: [object Object];
    attributeChangedCallback(name: string, old: ?string|null, value: ?string|null): any;
    _initializeProperties(): any;
    ready(): any;
    connectedCallback(): any;
    disconnectedCallback(): any;
    created(): any;
    attached(): any;
    detached(): any;
    attributeChanged(name: string, old: ?string|null, value: ?string|null): any;
    _registered(): any;
    _ensureAttributes(): any;
    _applyListeners(): any;
    serialize(value: any): (string|undefined);
    deserialize(value: string, type: any): any;
    reflectPropertyToAttribute(property: string, attribute?: string, value?: any): any;
    serializeValueToAttribute(value: any, attribute: string, node: Element): any;
    extend(prototype: Object, api: Object): Object;
    mixin(target: Object, source: Object): Object;
    chainObject(object: Object, prototype: Object): Object;
    instanceTemplate(template: HTMLTemplateElement): DocumentFragment;
    fire(type: string, detail?: any, options?: {bubbles: (boolean|undefined), cancelable: (boolean|undefined), composed: (boolean|undefined)}): Event;
    listen(node: Element, eventName: string, methodName: string): any;
    unlisten(node: Element, eventName: string, methodName: string): any;
    setScrollDirection(direction?: string, node?: Element): any;
    $$(slctr: string): Element;
    distributeContent(): any;
    getEffectiveChildNodes(): Array.<Node>;
    queryDistributedElements(selector: string): Array.<Node>;
    getEffectiveChildren(): Array.<Node>;
    getEffectiveTextContent(): string;
    queryEffectiveChildren(selector: string): Object.<Node>;
    queryAllEffectiveChildren(selector: string): Array.<Node>;
    getContentChildNodes(slctr?: string): Array.<Node>;
    getContentChildren(slctr?: string): Array.<HTMLElement>;
    isLightDescendant(node: ?Node|null): boolean;
    isLocalDescendant(node?: Element): boolean;
    scopeSubtree(container: any, shouldObserve: any): any;
    getComputedStyleValue(property: string): string;
    debounce(jobName: string, callback: function (), wait: number): Object;
    isDebouncerActive(jobName: string): boolean;
    flushDebouncer(jobName: string): any;
    cancelDebouncer(jobName: string): any;
    async(callback: Function, waitTime?: number): number;
    cancelAsync(handle: number): any;
    create(tag: string, props: Object): Element;
    importHref(href: string, onload: Function, onerror: Function, optAsync: boolean): HTMLLinkElement;
    elementMatches(selector: string, node?: Element): boolean;
    toggleAttribute(name: string, bool?: boolean, node?: Element): any;
    toggleClass(name: string, bool?: boolean, node?: Element): any;
    transform(transformText: string, node?: Element): any;
    translate3d(x: number, y: number, z: number, node?: Element): any;
    arrayDelete(arrayOrPath: (string|!Array.<(number|string)>), item: any): any[];
    _logger(level: string, args: any[]): any;
    _log(...args: any): any;
    _warn(...args: any): any;
    _error(...args: any): any;
    _logf(methodName: string, ...args: any): any[];
  }
  const LegacyElementMixin: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<LegacyElementMixin>;

  Polymer.mixinBehaviors(behaviors: !(Object|Array), klass: (!HTMLElement|function (new: HTMLElement))): function (new: HTMLElement);

  Polymer.Class(info: !PolymerInit): function (new: HTMLElement);

  interface MutableData {
    _shouldPropertyChange(property: string, value: any, old: any): boolean;
  }
  const MutableData: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<MutableData>;

  interface OptionalMutableData {
    mutableData: [object Object];
    _shouldPropertyChange(property: string, value: any, old: any): boolean;
  }
  const OptionalMutableData: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<OptionalMutableData>;

  class DomBind extends domBindBase {
    attributeChangedCallback(): any;
    connectedCallback(): any;
    disconnectedCallback(): any;
    render(): any;
  }

  class DomRepeat extends domRepeatBase {
    items: any[];
    as: [object Object];
    indexAs: [object Object];
    itemsIndexAs: [object Object];
    sort: [object Object];
    filter: [object Object];
    observe: [object Object];
    delay: [object Object];
    renderedItemCount: [object Object];
    initialCount: [object Object];
    targetFramerate: [object Object];
    _targetFrameTime: [object Object];
    disconnectedCallback(): any;
    connectedCallback(): any;
    render(): any;
    _showHideChildren(hidden: any): any;
    itemForElement(el: HTMLElement): any;
    indexForElement(el: HTMLElement): any;
    modelForElement(el: HTMLElement): TemplateInstanceBase;
  }

  class DomIf extends Polymer.Element {
    if: [object Object];
    restamp: [object Object];
    connectedCallback(): any;
    disconnectedCallback(): any;
    render(): any;
    _showHideChildren(): any;
  }

  interface ArraySelectorMixin extends ElementMixin{
    items: any[];
    multi: [object Object];
    selected: [object Object];
    selectedItem: [object Object];
    toggle: [object Object];
    clearSelection(): any;
    isSelected(item: any): boolean;
    isIndexSelected(idx: number): boolean;
    deselect(item: any): any;
    deselectIndex(idx: number): any;
    select(item: any): any;
    selectIndex(idx: number): any;
  }
  const ArraySelectorMixin: <T extends Constructor<HTMLElement>>(base: T) => T & Constructor<ArraySelectorMixin>;

  class ArraySelector extends baseArraySelector {
  }

  class CustomStyle extends HTMLElement {
    getStyle(): HTMLStyleElement;
  }

}