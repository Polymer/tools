class Element extends HTMLElement { }
customElements.define('my-element', Element);

/**
 * @customElement
 * @polymer
 */
class AnnotatedElement { }

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
