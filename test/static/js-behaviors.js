/** @polymerBehavior */
var SimpleBehavior = {
  simple: true,
};

/** @polymerBehavior AwesomeBehavior */
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
@polymerBehavior
*/
Really.Really.Deep.Behavior = [{
  deep: true,
}, Do.Re.Mi.Fa];

/**
@polymerBehavior
*/
CustomBehaviorList = [
  SimpleBehavior,
  CustomNamedBehavior,
  Really.Really.Deep.Behavior
];
