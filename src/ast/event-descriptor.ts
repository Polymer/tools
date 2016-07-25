import {Descriptor} from './descriptor.ts';
import {BehaviorOrName} from './behavior-descriptor.ts';

export interface EventDescriptor extends Descriptor {
  name?: string;
  __fromBehavior?: BehaviorOrName;
  params?: {
    type: string,
    desc: string,
    name: string
  }[];
}
