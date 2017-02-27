/**
 * @polymerMixin
 */
const TestMixin = (superclass) => class extends superclass {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      },
    };
  }
}
