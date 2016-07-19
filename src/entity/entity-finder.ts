import {Descriptor} from '../ast/ast';

export interface EntityFinder<T, D extends Descriptor> {
  find(ast: T, url: string): D[];
}
