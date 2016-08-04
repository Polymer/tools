import {PropertyDescriptor} from './property-descriptor';

export interface FunctionDescriptor extends PropertyDescriptor {
  function: boolean;  // true
  return: {type: string | null; desc: string};
}
