/// <reference path="boot.d.ts" />

declare namespace Polymer {

  namespace CaseMap {


    /**
     * Converts "dash-case" identifier (e.g. `foo-bar-baz`) to "camelCase"
     * (e.g. `fooBarBaz`).
     */
    function dashToCamelCase(dash: string): string;


    /**
     * Converts "camelCase" identifier (e.g. `fooBarBaz`) to "dash-case"
     * (e.g. `foo-bar-baz`).
     */
    function camelToDashCase(camel: string): string;
  }
}
