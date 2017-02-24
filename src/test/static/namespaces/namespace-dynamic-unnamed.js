/**
 * @namespace
 */
DynamicNamespace['ArrayNotation'] = {
  foo: 'bar'
};

var baz = 'abc';
/**
 * @namespace
 */
DynamicNamespace[baz] = {
  foo: 'bar'
};
