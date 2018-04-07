class Class {
  /** @public a static property with a getter */
  static get customStaticPropertyGetter() {
    return true;
  }

  /** @public a property with a getter */
  get customPropertyGetter() { return true; }

  /**
   * A boolean getter
   * @return {boolean}
   */
  get customPropertyGetterType() { return true; }

  /** @public a property with a getter/setter */
  get customPropertyWithGetterSetter() {
    return this._customPropertyWithGetterSetter;
  }

  set customPropertyWithGetterSetter(val) {
    this._customPropertyWithGetterSetter = val;
  }

  /** @public a property with a setter before getter */
  set customPropertyWithSetterFirst(val) {
    this._customPropertyWithSetterFirst = val;
  }

  get customPropertyWithSetterFirst() {
    return this._customPropertyWithSetterFirst;
  }

  /** @readonly */
  get customPropertyWithReadOnlyGetter() {
    return _customPropertyWithReadOnlyGetter;
  }

  set customPropertyWithReadOnlyGetter(val) {
    this._customPropertyWithReadOnlyGetter = val;
  }

  constructor() {
    /** @public a property */
    this.customPropertyWithValue = 5;
    /** @public a jsdoc property */
    this.customPropertyWithJSDoc;
  }
}

/** @type {string} */
Class.prototype.customPropertyOnProto;

Class.prototype.customPropertyOnProtoValue = 5;

/**
 * A property
 * @type {boolean|number}
 * @private
 * @readonly
 */
Class.prototype.customPropertyOnProtoDoc = true;

Class.prototype.__customPropertyOnProtoPrivate = true;
