/** @behavior */
var SimpleBehavior = {
  simple: true,
};

/** @behavior AwesomeBehavior */
var CustomNamedBehavior = {
  custom: true,
  properties: {
    a: {
      value: 1
    }
  }
};

/**
With a chained behavior
@behavior
*/
Really.Really.Deep.Behavior = [{
  deep: true,
}, Do.Re.Mi.Fa];
