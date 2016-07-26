import {Descriptor} from './descriptor';
import {BehaviorOrName} from './behavior-descriptor';

export interface EventDescriptor extends Descriptor {
  name?: string;
  __fromBehavior?: BehaviorOrName;
  params?: {
    type: string,
    desc: string,
    name: string
  }[];
}
