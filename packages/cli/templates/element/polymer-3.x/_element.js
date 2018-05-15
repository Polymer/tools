import {html, PolymerElement} from '@polymer/polymer/polymer-element.js';

/**
 * `<%= name %>`
 * <%= description %>
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
class <%= elementClassName %> extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
        }
      </style>
      <h2>Hello [[prop1]]!</h2>
    `;
  }
  static get properties() {
    return {
      prop1: {
        type: String,
        value: '<%= name %>',
      },
    };
  }
}

window.customElements.define('<%= name %>', <%= elementClassName %>);
