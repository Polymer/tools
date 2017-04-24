/**
 * @polymerMixin
 */
function Base(superclass) {
  return class extends superclass {
    static get properties() {
      return {
        foo: {
          notify: true,
          type: String,
        },
      };
    }

    /** This is a method. */
    baseMethod() { }

    /** @private this is a private method, don't use or overwrite me */
    privateMethod() { }

    /** @private this is a private method. Middle will overwrite it, even though it shouldn't. */
    privateOverriddenMethod() { }
    /**
     * Overwrite me plz!
     * @protected
     */
    overrideMethod() {}
  }
}

/**
 * @polymerMixin
 * @mixes Base
 */
function Middle(superclass) {
  return class extends Base(superclass) {
    static get properties() {
      return Object.assign({}, super.properties, {bar: {type: String}});
    }

    overrideMethod() { }
    /** also overriden */
    middleMethod() { }

    /** this is a mistake. */
    privateOverriddenMethod() { }

  };
}
