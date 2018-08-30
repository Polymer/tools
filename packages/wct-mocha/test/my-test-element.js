import { html, PolymerElement } from '@polymer/polymer/polymer-element.js';

class MyTestElement extends PolymerElement {
  static get template() {
    return html`
      <h1>[[title]]</h1>
    `;
  }

  static get properties() {
    return { title: { type: String } };
  }

  constructor() {
    super();
    this.title = 'untitled';
  }
}

customElements.define('my-test-element', MyTestElement);
