class Element extends HTMLElement { }
customElements.define('my-element', Element);

/** @polymerElement */
class AnnotatedElement { }

/** @polymerMixin */
function Mixin(superClass) {
  return class Mixin extends SuperClass { }
}

/** @polymerMixin */
AnnotatedMixin = CreateMixinSomehow();
