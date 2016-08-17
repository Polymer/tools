class ClassDeclaration extends HTMLElement {}

window.customElements.define('class-declaration', ClassDeclaration);

customElements.define('anonymous-class', class extends HTMLElement{});

const ClassExpression = class extends HTMLElement {};

customElements.define('class-expression', ClassExpression);

customElements.define('register-before-declaration', RegisterBeforeDeclaration);

class RegisterBeforeDeclaration extends HTMLElement {}

customElements.define('register-before-expression', RegisterBeforeExpression);

let RegisterBeforeExpression = class extends HTMLElement {}

/**
 * This is a description of WithObservedAttributes.
 */
class WithObservedAttributes extends HTMLElement {
  static get observedAttributes() {
    return [
      /** @type {boolean} When given the element is totally inactive */
      'disabled',
      /** @type {boolean} When given the element is expanded */
      'open', 'foo', 'bar'
    ];
  }
}

customElements.define(
    'vanilla-with-observed-attributes', WithObservedAttributes);
