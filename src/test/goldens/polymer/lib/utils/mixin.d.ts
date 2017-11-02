/// <reference path="boot.d.ts" />

declare namespace Polymer {


  /**
   * Wraps an ES6 class expression mixin such that the mixin is only applied
   * if it has not already been applied its base argument. Also memoizes mixin
   * applications.
   */
  function dedupingMixin(mixin: T|null): any;
}
