// Upstreamed as https://github.com/DefinitelyTyped/DefinitelyTyped/pull/11460
// delete this file once that's merged.

declare module 'cssbeautify' {
  interface Options {
    /**
     * A string used for the indentation of the declaration (default is 4
     * spaces).
     */
    indent: string;
    /**
     * Defines the placement of open curly brace, either end-of-line (default)
     * or separate-line
     */
    openbrace: 'end-of-line'|'separate-line';

    /**
     * Always inserts a semicolon after the last ruleset(default is false)
     */
    autosemicolon: boolean;
  }
  namespace beautify {}
  function beautify(cssText: string, options: Options): string;

  export = beautify;
}