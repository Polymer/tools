/// <reference path="lib/mixins/element-mixin.d.ts" />

declare namespace Polymer {

  /**
   * Base class that provides the core API for Polymer's meta-programming
   * features including template stamping, data-binding, attribute deserialization,
   * and property change observation.
   */
  class Element extends
    Polymer.ElementMixin(
    HTMLElement) {
  }
}
