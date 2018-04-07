/**
 * @polymerMixin
 * @memberof Polymer
 */
const TestMixin = function(superclass) {
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
