/**
 * @polymerMixin
 */
Polymer.TestMixin = Polymer.woohoo(function TestMixin(base) {
  /** @polymerMixinClass */
  class TestMixin extends base {
    static get properties() {
      return {
        foo: {
          notify: true,
          type: String,
        },
      };
    };
  };
  return TestMixin;
});
