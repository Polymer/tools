/**
 * @polymerMixin
 */
const TestMixin = function(superclass) {
  return class extends superclass {
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
}
