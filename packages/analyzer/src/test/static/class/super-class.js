class Base {
  /**
   * @returns {Base}
   */
  constructor() {

  }
  /** This is a base method. */
  baseMethod() {
  }
  /** Will be overriden by Subclass. */
  overriddenMethod() {
  }
}

class Subclass extends Base {
  /**
   * @returns {Subclass}
   */
  constructor() {

  }
  /** Overrides the method on Base. */
  overriddenMethod() {

  }

  /** This method only exists on Subclass. */
  subMethod() {

  }
}
