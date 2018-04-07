/**
 * @mixinFunction
 * @polymer
 */
Polymer.TestMixin = Polymer.woohoo(function TestMixin(base) {
  /**
   * @mixinClass
   * @polymer
   */
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
