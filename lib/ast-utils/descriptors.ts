import * as estree from 'estree';
import * as jsdoc from './jsdoc';
import * as dom5 from 'dom5';

export type LiteralValue = string|number|boolean|RegExp;

export interface Descriptor {
  jsdoc?: jsdoc.Annotation;
  desc?: string;
}

export interface PropertyDescriptor extends Descriptor {
  name: string,
  type: string,
  desc: string,
  javascriptNode: estree.Node;
  params?: {name: string}[];
  published?: boolean;
  notify?: LiteralValue;
  observer?: LiteralValue;
  observerNode?: estree.Expression;
  readOnly?: LiteralValue;
  reflectToAttribute?: LiteralValue;
  default?: LiteralValue;
  private?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;

  __fromBehavior?: BehaviorOrName;
}

export interface ElementDescriptor extends Descriptor {
  is?: string;
  properties?: PropertyDescriptor[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors?: BehaviorOrName[];

  type: string; // 'element' | 'behavior'
  demos?: {
    desc: string;
    path: string;
  }[];
  events?: EventDescriptor[];
  hero?: string;
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;
}

export interface BehaviorDescriptor extends ElementDescriptor {
  symbol?: string;
}

export interface EventDescriptor extends Descriptor {
  name?: string;
  __fromBehavior?: BehaviorDescriptor;
  params?: {
    type: string,
    desc: string,
    name: string
  }[];
}

type BehaviorOrName = LiteralValue|BehaviorDescriptor;

export interface FunctionDescriptor extends PropertyDescriptor {
  function: boolean; // true
  return: {
    type: string;
    desc: string;
  };
}

export interface FeatureDescriptor extends ElementDescriptor {

}

export type BehaviorsByName = {[name: string]: BehaviorDescriptor};
