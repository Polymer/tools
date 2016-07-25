/**
 * Resolves the given URL to the concrete URL that a resource can
 * be loaded from.
 *
 * This can be useful to resolve name to paths, such as resolving 'polymer' to
 * '../polymer/polymer.html', or component paths, like '../polymer/polymer.html'
 * to '/bower_components/polymer/polymer.html'.
 */
export interface UrlResolver {

  /**
   * Returns `true` if this resolver can resolve the given `url`.
   */
  canResolve(url: string): boolean;

  /**
   * Resoves `url` to a new location.
   */
  resolve(url: string): string;
}
