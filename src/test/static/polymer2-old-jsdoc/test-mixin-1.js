/**
 * A mixin description
 * @summary A mixin summary
 * @polymerMixin
 */
function TestMixin(superclass) {
  return class extends superclass {
    static get properties() {
      return {
        foo: {
          notify: true,
          type: String,
        },
      };
    }
  }
}
