/// <reference path="boot.d.ts" />

declare namespace Polymer {


  /**
   * Convenience method for importing an HTML document imperatively.
   * 
   * This method creates a new `<link rel="import">` element with
   * the provided URL and appends it to the document to start loading.
   * In the `onload` callback, the `import` property of the `link`
   * element will contain the imported document contents.
   */
  function importHref(href: string, onload?: Function|null, onerror?: Function|null, optAsync?: boolean): HTMLLinkElement|null;
}
