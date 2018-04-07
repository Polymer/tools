/**
 * @polymer
 * @mixinFunction
 * @memberof Polymer
 */
class TestMixin extends superclass {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      },
    };
  }
}
