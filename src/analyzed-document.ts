import {DocumentDescriptor} from './ast/document-descriptor';
import {ParsedImport} from './ast-utils/import-parse';

/**
 * The metadata of an entire HTML document, in promises.
 */
export interface AnalyzedDocument {
  /**
   * The url of the document.
   */
  href: string;
  /**
   * The parsed representation of the doc. Use the `ast` property to get
   * the full `parse5` ast.
   */
  htmlLoaded: Promise<ParsedImport>;

  /**
   * Resolves to the list of this Document's transitive import dependencies.
   */
  depsLoaded: Promise<string[]>;

  /**
   * The direct dependencies of the document.
   */
  depHrefs: string[];
  /**
   * Resolves to the list of this Document's import dependencies
   */
  metadataLoaded: Promise<DocumentDescriptor>;
}
