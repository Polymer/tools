// Delete once https://github.com/PolymerLabs/shady-css-parser/pull/16 lands.

declare module 'shady-css-parser' {
  export class Parser { parse(cssText: string): Stylesheet; }
  export type Node = Stylesheet | AtRule | Comment | Rulelist | Ruleset |
      Declaration | Expression | Discarded;
  export type Rule = Comment | AtRule | Ruleset | Declaration | Discarded;

  export interface Stylesheet {
    type: 'stylesheet';
    /** The list of rules that appear at the top level of the stylesheet. */
    rules: Rule[];
  }
  export interface AtRule {
    type: 'atRule';
    /** The "name" of the At Rule (e.g., `charset`) */
    name: string;
    /** The "parameters" of the At Rule (e.g., `utf8`) */
    parameters: string;
    /** The Rulelist node (if any) of the At Rule. */
    rulelist?: Rulelist;
  }
  export interface Comment {
    type: 'comment';
    /**
     * The full text content of the comment, including opening and closing
     * comment signature.
     */
    value: string;
  }
  export interface Rulelist {
    type: 'rulelist';
    /** An array of the Rule nodes found within the Ruleset. */
    rules: Rule[];
  }
  export interface Ruleset {
    type: 'ruleset';
    /** The selector that corresponds to the Selector (e.g., `#foo > .bar`). */
    selector: string;
    /** The Rulelist node that corresponds to the Selector. */
    rulelist: Rulelist;
  }
  export interface Declaration {
    type: 'declaration';
    /** The property name of the Declaration (e.g., `color`). */
    name: string;
    value: Expression|Rulelist;
  }
  export interface Expression {
    type: 'expression';
    /** The full text content of the expression (e.g., `url(img.jpg)`) */
    text: string;
  }
  /**
   * Discarded nodes contain content that was not parseable (usually due to
   * typos, or otherwise unrecognized syntax).
   */
  export interface Discarded {
    type: 'discarded';
    /** The text content that is discarded. */
    text: string;
  }

  export abstract class NodeVisitor<T> {
    readonly path: Node[];
    visit(node: Node): T;
    abstract stylesheet(stylesheet: Stylesheet): T;
    abstract atRule(atRule: AtRule): T;
    abstract comment(comment: Comment): T;
    abstract rulelist(rulelist: Rulelist): T;
    abstract ruleset(ruleset: Ruleset): T;
    abstract declaration(declaration: Declaration): T;
    abstract expression(expression: Expression): T;
    abstract discarded(discarded: Discarded): T;
  }

  export class Stringifier extends NodeVisitor<string> {
    stringify(node: Node): string;
    stylesheet(stylesheet: Stylesheet): string;
    atRule(atRule: AtRule): string;
    comment(comment: Comment): string;
    rulelist(rulelist: Rulelist): string;
    ruleset(ruleset: Ruleset): string;
    declaration(declaration: Declaration): string;
    expression(expression: Expression): string;
    discarded(discarded: Discarded): string;
  }
}
