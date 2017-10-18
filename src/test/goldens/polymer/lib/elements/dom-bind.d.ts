declare namespace Polymer {

  /**
   * Custom element to allow using Polymer's template features (data binding,
   * declarative event listeners, etc.) in the main document without defining
   * a new custom element.
   * 
   * `<template>` tags utilizing bindings may be wrapped with the `<dom-bind>`
   * element, which will immediately stamp the wrapped template into the main
   * document and bind elements to the `dom-bind` element itself as the
   * binding scope.
   */
  interface DomBind extends Polymer.Element {

    /**
     * assumes only one observed attribute
     */
    attributeChangedCallback(): any;
    connectedCallback(): any;
    disconnectedCallback(): any;
    __insertChildren(): any;
    __removeChildren(): any;

    /**
     * Forces the element to render its content. This is typically only
     * necessary to call if HTMLImports with the async attribute are used.
     */
    render(): any;
  }
}

interface HTMLElementTagNameMap {
  "dom-bind": Polymer.DomBind;
}
