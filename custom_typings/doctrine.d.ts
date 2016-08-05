/**
 * Doctrine is a JSDoc parser that parses documentation comments from JavaScript
 * (you need to pass in the comment, not a whole JavaScript file).
 */

declare module 'doctrine' {
  export interface Tag {
    /** The type of jsdoc tag parsed. @foo will have a title of 'foo'. */
    title: string;
    /** The name of the thing being documented, if any. */
    name?: string;
    /** The description of the thing being documented. */
    description: string|null;
    /** The type of the thing being documented. */
    type?: Type|null;
    kind?: string;
    /** Any errors that were encountered in parsing the tag. */
    errors?: string[];
  }
  export type Type =
      ({type: 'NullableLiteral'} | {type: 'AllLiteral'} |
       {type: 'NullLiteral'} | {type: 'UndefinedLiteral'} |
       {type: 'VoidLiteral'} | {type: 'UnionType', elements: Type[]} |
       {type: 'ArrayType', elements: Type[]} |
       {type: 'RecordType', fields: Type[]} |
       {type: 'FieldType', key: string, value?: Type} |
       {type: 'ParameterType', name: string, expression: Type} |
       {
         type: 'RestType';
         expression?: Type;
       } |
       {type: 'NonNullableType', prefix: boolean, expression: Type} |
       {type: 'NullableType', prefix: boolean, expression: Type} |
       {type: 'OptionalType', expression: Type} |
       {type: 'NameExpression', name: string} |
       {type: 'TypeApplication', expression: Type, applications: Type[]} | {
         type: 'FunctionType',
         'this': Type,
         'new': Type,
         params: Type[],
         result: Type[]
       });

  export var type: {
    stringify(type: Type): string;
    parseType(src: string, options?: {midstream: boolean}): Type;
    parseParamType(src: string, options?: {midstream: boolean}): Type;
    Syntax: {
      NullableLiteral: 'NullableLiteral',
      AllLiteral: 'AllLiteral',
      NullLiteral: 'NullLiteral',
      UndefinedLiteral: 'UndefinedLiteral',
      VoidLiteral: 'VoidLiteral',
      UnionType: 'UnionType',
      ArrayType: 'ArrayType',
      RecordType: 'RecordType',
      FieldType: 'FieldType',
      FunctionType: 'FunctionType',
      ParameterType: 'ParameterType',
      RestType: 'RestType',
      NonNullableType: 'NonNullableType',
      OptionalType: 'OptionalType',
      NullableType: 'NullableType',
      NameExpression: 'NameExpression',
      TypeApplication: 'TypeApplication'
    }
  };
  interface Options {
    /**
     * Set to `true` to delete the leading `/**`, any `*` that begins a line,
     * and the trailing `* /` from the source text. Default: `false`.
     */
    unwrap?: boolean;
    /**
     * An array of tags to return. When specified, Doctrine returns
     * only tags in this array. For example, if `tags` is `["param"]`, then only
     * `@param` tags will be returned. Default: `null`.
     */
    tags?: string[];
    /**
     * set to `true` to keep parsing even when syntax errors occur. Default:
     * `false`.
     */
    recoverable?: boolean;
    /**
     * Set to `true` to allow optional parameters to be specified in brackets
     * (`@param {string} [foo]`). Default: `false`.
     */
    sloppy?: boolean;
    /**
     * Set to `true` to throw an error when syntax errors occur. If false then
     * errors will be added to `tag.errors` instead.
     */
    strict?: boolean;
    /**
     * Set to `true` to preserve leading and trailing whitespace when extracting
     * comment text.
     */
    preserveWhitespace?: boolean;
    /**
     * Set to `true` to add `lineNumber` to each node, specifying the line on
     * which the node is found in the source. Default: `false`.
     */
    lineNumbers?: boolean;
  }
  interface Annotation {
    description: string;
    tags: Tag[];
  }
  /**
   * Parse the given content as a jsdoc comment.
   */
  export function parse(content: string, options: Options): Annotation;
  /**
   * Remove /*, *, and * / from jsdoc.
   */
  export function unwrapComment(doc: string): string;

  export const version: string;
  export const parseType: typeof type.parseType;
  export const parseParamType: typeof type.parseParamType;
  export const Syntax: typeof type.Syntax;
}
