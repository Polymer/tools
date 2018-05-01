interface Window {
  define: ((deps: string[], factory: ResolveCallback) => void)&{
    _reset?: () => void;
  };
}

type Registry = {
  [url: string]: Module
};

interface Module {
  url: NormalizedUrl;
  urlBase: NormalizedUrl;
  exports: {[id: string]: {}};
  /** This is a top-level module. */
  isTopLevel: boolean;
  /** This module hasn't started loading its script yet. */
  needsLoad: boolean;
  /** All dependencies are resolved and the factory has run. */
  resolved: boolean;
  error: Error|undefined;
  /** Callbacks from dependents waiting for this module to resolve. */
  onResolve: Array<() => void>;
  onError: Array<ErrorCallback>;
}

type ResolveCallback = (...args: Array<{}>) => void;
type ErrorCallback = (error: Error) => void;
type NormalizedUrl = string&{_normalized: never};

(function() {

/**
 * A global map from a fully qualified module URLs to module objects.
 */
const registry: {[url: string]: Module} = Object.create(null);

let pendingDefine: ((mod: Module) => void)|undefined = undefined;
let topLevelScriptIdx = 0;
let previousTopLevelUrl: string|undefined = undefined;

/**
 * Define a module and execute its factory function when all dependencies are
 * resolved.
 *
 * Dependencies must be specified as URLs, either relative or fully qualified
 * (e.g. "../foo.js" or "http://example.com/bar.js" but not "my-module-name").
 */
window.define = function(deps: string[], factory?: ResolveCallback) {
  // We don't yet know our own module URL. We need to discover it so that we
  // can resolve our relative dependency specifiers. There are two ways the
  // script executing this define() call could have been loaded:

  // Case #1: We are a dependency of another module. A <script> was injected
  // to load us, but we don't yet know the URL that was used. Because
  // document.currentScript is not supported by IE, we communicate the URL via
  // a global callback. When finished executing, the "onload" event will be
  // fired by this <script>, which will be handled by the loading script,
  // which will invoke the callback with our module object.
  let defined = false;
  pendingDefine = (mod) => {
    defined = true;
    pendingDefine = undefined;
    define(mod, deps, factory);
  };

  // Case #2: We are a top-level script in the HTML document. Our URL is the
  // document's base URL. We can discover this case by waiting a tick, and if
  // we haven't already been defined by the "onload" handler from case #1,
  // then this must be case #2.
  setTimeout(() => {
    if (defined === false) {
      pendingDefine = undefined;
      const url = document.baseURI + '#' + topLevelScriptIdx++ as NormalizedUrl;
      const mod = getModule(url);

      // Top-level scripts are already loaded.
      mod.isTopLevel = true;
      mod.needsLoad = false;

      if (previousTopLevelUrl !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, inject a
        // dependency on the previous top-level script to preserve the
        // relative ordering.
        deps.push(previousTopLevelUrl);
      }
      previousTopLevelUrl = url;
      define(mod, deps, factory);
    }
  }, 0);
};

/**
 * Reset all internal state for testing and debugging.
 */
window.define._reset = () => {
  for (const url in registry) {
    delete registry[url];
  }
  pendingDefine = undefined;
  topLevelScriptIdx = 0;
  previousTopLevelUrl = undefined;
};

/**
 * Return a module object from the registry for the given URL, creating one if
 * it doesn't exist yet.
 */
function getModule(url: NormalizedUrl): Module {
  let mod = registry[url];
  if (mod === undefined) {
    mod = registry[url] = {
      url,
      urlBase: getUrlBase(url),
      exports: Object.create(null),
      isTopLevel: false,
      resolved: false,
      needsLoad: true,
      error: undefined,
      onResolve: [],
      onError: [],
    };
  }
  return mod;
}

/**
 * Initialize a module with its dependencies and factory function. Note that
 * Module objects are created and registered before they are loaded, which is
 * why this is not simply part of creation.
 */
function define(mod: Module, deps: string[], factory?: ResolveCallback) {
  function onLoad(...args: Array<{}>) {
    if (factory !== undefined) {
      factory.apply(null, args);
    }
    mod.resolved = true;
    for (const callback of mod.onResolve) {
      callback();
    }
  }

  require(mod, deps, onLoad, (error: Error) => modError(mod, error));
}

/**
 * Called when a module has failed to load, either becuase its script errored,
 * or because one of its transitive dependencies errored.
 */
function modError(mod: Module, error: Error) {
  mod.error = error;
  for (const callback of mod.onError) {
    callback(error);
  }
}

/**
 * Execute onResolve when all dependencies have resolved, or onError if any of
 * the dependencies fail.
 */
function require(
    mod: Module,
    deps: string[],
    onResolve?: ResolveCallback,
    onError?: ErrorCallback) {
  const args: Array<{}> = [];
  let numUnresolvedDeps = deps.length;

  function onDepResolved() {
    numUnresolvedDeps--;
    checkIfAllDepsResolved();
  }

  let calledOnError = false;
  function callOnErrorOnce(error: Error) {
    if (onError !== undefined && calledOnError === false) {
      onError(error);
      calledOnError = true;
    }
  }

  function checkIfAllDepsResolved() {
    if (numUnresolvedDeps === 0 && onResolve !== undefined) {
      onResolve.apply(null, args);
    }
  }

  for (const depSpec of deps) {
    if (depSpec === 'exports') {
      numUnresolvedDeps--;
      args.push(mod.exports);

    } else if (depSpec === 'require') {
      numUnresolvedDeps--;
      args.push(
          (deps: string[],
           onResolve?: ResolveCallback,
           onError?: ErrorCallback) => require(mod, deps, onResolve, onError));

    } else if (depSpec === 'meta') {
      numUnresolvedDeps--;
      args.push({url: mod.url});

    } else {
      const depMod = getModule(resolveUrl(mod.urlBase, depSpec));
      args.push(depMod.exports);

      if (depMod.resolved === true) {
        numUnresolvedDeps--;

      } else {
        // If this is a top-level dependency, we don't actually care if it fails
        // to load. We only added this dependency to enforce ordering. Act like
        // it resolved normally if it errors.
        const onDepError =
            depMod.isTopLevel === true ? onDepResolved : callOnErrorOnce;

        if (depMod.error !== undefined) {
          onDepError(depMod.error);

        } else {
          depMod.onResolve.push(onDepResolved);
          depMod.onError.push(onDepError);
          loadIfNeeded(depMod);
        }
      }
    }
  }

  checkIfAllDepsResolved();
}

/**
 * Load a module by creating a <script> tag in the document <head>, unless we
 * have already started (or didn't need to, as in the case of top-level
 * scripts).
 */
function loadIfNeeded(mod: Module) {
  if (mod.needsLoad === false) {
    return;
  }
  mod.needsLoad = false;

  const script = document.createElement('script');
  script.src = mod.url;

  script.onload = () => {
    if (pendingDefine !== undefined) {
      pendingDefine(mod);
    } else {
      // The script did not make a call to define(), otherwise the global
      // callback would have been set. That's fine, we can resolve immediately
      // because we don't have any dependencies, by definition.
      define(mod, []);
    }
  };

  script.onerror = () =>
      modError(mod, new TypeError('Failed to fetch ' + mod.url));

  document.head.appendChild(script);
}

const anchor = document.createElement('a');

/**
 * Use the browser to resolve a URL to its canonical format.
 *
 * Examples:
 *
 *  - //example.com/ => http://example.com/
 *  - http://example.com => http://example.com/
 *  - http://example.com/foo/bar/../baz => http://example.com/foo/baz
 */
function normalizeUrl(url: string): NormalizedUrl {
  anchor.href = url;
  return anchor.href as NormalizedUrl;
}

/**
 * Examples:
 *
 *  - http://example.com/ => http://example.com/
 *  - http://example.com/foo.js => http://example.com/
 *  - http://example.com/foo/ => http://example.com/foo/
 *  - http://example.com/foo/?qu/ery#fr/ag => http://example.com/foo/
 */
function getUrlBase(url: NormalizedUrl): NormalizedUrl {
  url = url.split('?')[0] as NormalizedUrl;
  url = url.split('#')[0] as NormalizedUrl;
  // Normalization ensures we always have a trailing slash after a bare domain,
  // so this will always return with a trailing slash.
  return url.substring(0, url.lastIndexOf('/') + 1) as NormalizedUrl;
}

/**
 * Resolve a URL relative to a normalized base URL.
 */
function resolveUrl(urlBase: NormalizedUrl, url: string): NormalizedUrl {
  if (url.indexOf('://') !== -1) {
    // Already a fully qualified URL.
    return url as NormalizedUrl;
  }
  return normalizeUrl(urlBase + url);
}
})();
