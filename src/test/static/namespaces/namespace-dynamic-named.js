/**
 * @namespace DynamicNamespace.ComputedProperty
 */
DynamicNamespace['ComputedProperty'] = {
  foo: 'bar'
};

var baz = 'abc';
/**
 * @namespace DynamicNamespace.UnanalyzableComputedProperty
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
