import * as estree from 'estree';

import {BehaviorOrName} from './behavior-descriptor';
import {Descriptor, LiteralValue} from './descriptor';

// TODO(justinfagnani): Rename, this name clashes with ES6's PropertyDescriptor
export interface PropertyDescriptor extends Descriptor {
  name: string;
  type: string;
  desc: string;
  javascriptNode: estree.Node;
  params?: {name: string}[];
  published?: boolean;
  notify?: LiteralValue;
  observer?: LiteralValue;
  observerNode?: estree.Expression;
  readOnly?: LiteralValue;
  reflectToAttribute?: LiteralValue;
  'default'?: LiteralValue;
  private?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;

  __fromBehavior?: BehaviorOrName;
}
