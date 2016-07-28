import * as jsdoc from '../javascript/jsdoc';

export type LiteralValue = string | number | boolean | RegExp;

export interface Descriptor {
  jsdoc?: jsdoc.Annotation;
  desc?: string;
  node?: any;
}
