import * as dom5 from 'dom5';
import * as estree from 'estree';

import {BehaviorOrName} from './behavior-descriptor';
import {Descriptor, LiteralValue} from './descriptor';
import {EventDescriptor} from './event-descriptor';
import {PropertyDescriptor} from './property-descriptor';


/**
 * The metadata for a single polymer element
 */
export interface ElementDescriptor extends Descriptor {
  is?: string;
  contentHref?: string;
  properties?: PropertyDescriptor[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors?: BehaviorOrName[];

  type: string;  // 'element' | 'behavior'
  demos?: {desc: string; path: string}[];
  events?: EventDescriptor[];
  hero?: string;
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;
}
