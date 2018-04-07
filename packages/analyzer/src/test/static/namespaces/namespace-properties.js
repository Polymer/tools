/**
 * @namespace PropertiesNamespace
 */
var PropertiesNamespace = {
  property: 'foo',
  get propertyWithGetter() {
    return true;
  },
  get propertyWithGetterSetter() {
    return true;
  },
  set propertyWithGetterSetter(v) {},
  set propertyWithSetterFirst(v) {},
  get propertyWithSetterFirst() {
    return true;
  },
  notAProperty: function() {},
  notAPropertyEither() {
  },
  /**
   * Property with annotation
   * @type {string|number}
   */
  propertyWithAnnotation: 'foo',
  /**
   * @readonly
   */
  propertyWithReadOnly: 'foo'
};

/**
 * @memberof PropertiesNamespace
 */
PropertiesNamespace.propertyDefinedLater = 'foo';

/**
 * Test property
 * @memberof PropertiesNamespace
 */
PropertiesNamespace.propertyDefinedLaterWithAnnotation = true;

PropertiesNamespace.propertyNotMemberOf = true;

/**
 * @memberof PropertiesNamespace
 */
PropertiesNamespace.notAPropertyDefinedLater = function() {};

/**
 * @memberof PropertiesNamespace.prototype
 * @type {string}
 */
PropertiesNamespace.prototype.instanceProperty;

/**
 * @memberof PropertiesNamespace
 * @type {string}
 */
PropertiesNamespace.propertyDefinedLaterWithoutValue;
