class MyClass {
  no_params() { }

  one_param(p1) { }

  two_params(p1, p2) { }

  /**
   * @return {boolean}
   */
  typed_return() { }

  /**
   * @param {string} p1
   * @param {number} p2
   * @return {boolean}
   */
  two_typed_params_and_typed_return(p1, p2) { }

  /**
   * @param {...string} p1
   */
  typed_rest_param(...p1) { }

  /**
   * @param {string=} p1
   */
  optional_param(p1) { }

  /**
   * @param {string=} p2
   */
  required_and_optional_param(p1, p2) { }
}
