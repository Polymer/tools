/**
 * @namespace
 */
var ImplicitlyNamedNamespace = {};

/**
 * @namespace
 */
ImplicitlyNamedNamespace.NestedNamespace = {
  foo: 'bar'
};

/**
 * @namespace
 * @memberof ParentNamespace
 */
FooNamespace = {
  foo: 'bar'
};

/**
 * @namespace
 * @memberof ParentNamespace
 */
ParentNamespace.BarNamespace = {
  foo: 'bar'
};