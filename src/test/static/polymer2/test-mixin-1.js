/**
 * Foo
 * @polymerMixin A description
 */
function TestMixin(superclass) {
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
