/**
 * @namespace DynamicNamespace.ArrayNotation
 */
DynamicNamespace['ArrayNotation'] = {
  foo: 'bar'
};

var baz = 'abc';
/**
 * @namespace DynamicNamespace.DynamicArrayNotation
 */
DynamicNamespace[baz] = {
  foo: 'bar'
};

/**
 * @namespace DynamicNamespace.Aliased
 */
aliasToNamespace = {
  foo: 'bar'
};