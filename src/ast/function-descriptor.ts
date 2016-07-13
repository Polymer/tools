import {PropertyDescriptor} from './property-descriptor.ts';

export interface FunctionDescriptor extends PropertyDescriptor {
  function: boolean; // true
  return: {
    type: string;
    desc: string;
  };
}
