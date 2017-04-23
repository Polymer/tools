/**
 * A mixin description
 * @summary A mixin summary
 * @polymer
 * @mixinFunction
 * @memberof Polymer
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
