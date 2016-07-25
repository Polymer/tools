import {ElementDescriptor} from './element-descriptor';

/**
 * The metadata for a Polymer behavior mixin.
 */
export interface BehaviorDescriptor extends ElementDescriptor {
  symbol?: string;
}

export type BehaviorOrName = BehaviorDescriptor | string;

export type BehaviorsByName = {[name: string]: BehaviorDescriptor};
