import {BehaviorOrName} from './behavior-descriptor';
import {Descriptor} from './descriptor';

export interface EventDescriptor extends Descriptor {
  name?: string;
  __fromBehavior?: BehaviorOrName;
  params?: {type: string, desc: string, name: string}[];
}
