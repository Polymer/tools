import {DocumentDescriptor} from './ast/ast';
import {SerializedAnalysis} from './serialized-analysis';

export class Analysis {
  private descriptors_: DocumentDescriptor[];
  constructor(descriptors: DocumentDescriptor[]) {
    this.descriptors_ = descriptors;
  }

  serialize(): SerializedAnalysis {
    throw new Error('not implemented');
  }
}