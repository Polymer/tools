import {ElementDescriptor, Options as ElementOptions} from './element-descriptor';

export interface Options extends ElementOptions { symbol?: string; }

/**
 * The metadata for a Polymer behavior mixin.
 */
export class BehaviorDescriptor extends ElementDescriptor {
  symbol?: string;

  constructor(options: Options) {
    super(options);
    this.symbol = options.symbol;
  }
}

export type BehaviorOrName = BehaviorDescriptor | string;

export type BehaviorsByName = {
  [name: string]: BehaviorDescriptor
};
