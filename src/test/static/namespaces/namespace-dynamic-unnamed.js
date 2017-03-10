/**
 * @namespace
 */
DynamicNamespace['ArrayNotation'] = {
  foo: 'bar'
};

var baz = 'abc';
/**
 * We can't look this up yet.
 * @namespace
 */
DynamicNamespace[baz] = {
  foo: 'bar'
};
