import * as estree from 'estree';
import * as dom5 from 'dom5';

import {ParsedImport} from '../ast-utils/import-parse';

import {ElementDescriptor} from './element-descriptor';
import {FeatureDescriptor} from './feature-descriptor';
import {BehaviorDescriptor} from './behavior-descriptor';

/**
 * The metadata for all features and elements defined in one document
 */
export interface DocumentDescriptor {
  /**
   * The elements from the document.
   */
  elements: ElementDescriptor[];

  /**
   * The features from the document
   */
  features: FeatureDescriptor[];

  /**
   * The behaviors from the document
   */
  behaviors: BehaviorDescriptor[];

  href?: string;

  imports?: DocumentDescriptor[];

  parsedScript?: estree.Program;

  html?: ParsedImport;
}
