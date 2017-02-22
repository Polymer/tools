/**
 * @polymerMixin
 */
Polymer.TestMixin = Polymer.woohoo(function TestMixin(base) {
  /** @polymerMixinClass */
  class TestMixin extends base {
    static get config() {
      return {
        properties: {
          foo: {
            notify: true,
            type: String,
          }
        },
      };
    };
  };
  return TestMixin;
});
