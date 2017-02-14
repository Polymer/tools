/**
 * @polymerMixin
 */
class TestMixin extends superclass {
  static get config() {
    return {
      properties: {
        foo: {
          notify: true,
          type: String,
        }
      },
    };
  }
}
