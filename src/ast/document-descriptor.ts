
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
