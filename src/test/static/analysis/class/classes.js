class Element extends HTMLElement { }
customElements.define('my-element', Element);

/**
 * @customElement
 * @polymer
 */
class AnnotatedElement { static get is() {return 'annotated-elem'} }

/**
 * @mixinFunction
 * @polymer
 */
function Mixin(superClass) {
  return class Mixin extends SuperClass { }
}

/**
 * @mixinFunction
 * @polymer
 */
AnnotatedMixin = CreateMixinSomehow();


class Base {
  /** This is a base method. */
  baseMethod() {
  }
  /** Will be overriden by Subclass. */
  overriddenMethod() {
  }
}

class Subclass extends Base {
  /** Overrides the method on Base. */
  overriddenMethod() {

  }

  /** This method only exists on Subclass. */
  subMethod() {

  }
}

