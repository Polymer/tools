
/**
 * An object that reads files.
 */
export interface UrlLoader {
  /**
   * Returns `true` if this loader can load the given `url`.
   */
  canLoad(url: string): boolean;

  /**
   * Reads a file from `url`.
   *
   * This should only be called if `canLoad` returns `true` for `url`.
   */
  load(url: string): Promise<string>;

  /**
   * Lists files in a directory in the current project.
   *
   * @param path A relative path to a directory to read.
   * @param deep If true, lists files recursively. Returned paths are
   *     relative to `url`.
   */
  readDirectory?(path: string, deep?: boolean): Promise<string[]>;
}
