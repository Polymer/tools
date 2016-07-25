
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
  load(url: string) : Promise<string>;

}
