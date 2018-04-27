(function() {
class Registry {
  modules: {[url: string]: Module} = Object.create(null);
  topLevelIdx = 0;
  previousTopLevelUrl: string|undefined = undefined;
  pendingDefine: ((mod: Module) => void)|undefined = undefined;

  get(url: string): Module {
    let mod = this.modules[url];
    if (mod === undefined) {
      mod = this.modules[url] = new Module(url);
    }
    return mod;
  }
}

const registry = new Registry();

function getBasePath(url: string): string {
  // TODO(aomarks) Maybe a better way to do this.
  var lastSlash = url.lastIndexOf('/');
  if (lastSlash === url.indexOf('://') + 2) {
    // http://example.com -> http://example.com/
    return url + '/';
  }
  // http://example.com/foo/bar.html -> http://example.com/foo/
  return url.substring(0, lastSlash + 1);
}

class Module {
  url: string;
  basePath: string;
  exports = {};
  loadStartedOrDone = false;
  // All of this module's dependencies are resolved and its factory has run.
  resolved = false;
  // Callbacks from dependents waiting to hear when this module has resolved.
  notify: Array<() => void> = [];

  constructor(url: string) {
    this.url = url;
    this.basePath = getBasePath(this.url);
  }

  static resolverAnchor = document.createElement('a');

  init(deps: string[], factory: (...args: {}[]) => void) {
    const factoryArgs: {}[] = [];
    let numUnresolvedDeps = 0;

    function onDepResolved() {
      numUnresolvedDeps--;
      maybeResolve();
    }

    var thisResolve = this.resolve.bind(this);
    function maybeResolve() {
      if (numUnresolvedDeps === 0) {
        factory.apply(null, factoryArgs);
        thisResolve();
      }
    }

    for (var i = 0; i < deps.length; i++) {
      var depSpec = deps[i];

      if (depSpec === 'exports') {
        factoryArgs[i] = this.exports;

      } else if (depSpec === 'require') {
        factoryArgs[i] = this.makeDynamicImporter();

      } else if (depSpec === 'meta') {
        // TODO(aomarks) This is an idea for replacing the import.meta
        // transform.
        factoryArgs[i] = {url: this.url};

      } else {
        var depMod = registry.get(this.resolveUrl(depSpec));
        factoryArgs[i] = depMod.exports;

        if (depMod.resolved === false) {
          numUnresolvedDeps++;
          depMod.notify.push(onDepResolved);
          depMod.loadOnce();
        }
      }
    }

    maybeResolve();
  }

  resolve() {
    this.resolved = true;
    for (var i = 0; i < this.notify.length; i++) {
      this.notify[i]();
    }
  }

  resolveUrl(path: string) {
    if (path.indexOf('://') !== -1) {
      // Already a fully qualified URL.
      // TODO(aomarks) Is this a good enough check?
      return path;
    }
    // Just let the browser do path resolution/normalization.
    Module.resolverAnchor.href = this.basePath + path;
    return Module.resolverAnchor.href;
  }

  makeDynamicImporter() {
    var resolveUrl = this.resolveUrl.bind(this);
    return function(spec: string, callback: (exports: {}) => void) {
      var mod = registry.get(resolveUrl(spec));
      if (mod.resolved === true) {
        callback(mod.exports);
      } else {
        mod.notify.push(function() {
          callback(mod.exports);
        });
        mod.loadOnce();
      }
    };
  }

  loadOnce() {
    if (this.loadStartedOrDone === true) {
      return;
    }
    this.loadStartedOrDone = true;

    var script = document.createElement('script');
    script.src = this.url;

    var mod = this;
    script.onload = function() {
      if (registry.pendingDefine !== undefined) {
        registry.pendingDefine(mod);
      } else {
        // The script did not make a call to define(), otherwise the global
        // callback would have been set. That's fine, we can resolve it
        // immediately, because it doesn't have any dependencies.
        mod.resolve();
      }
    };

    script.onerror = function() {
      throw new Error('error loading module ' + mod.url);
    };

    document.head.appendChild(script);
  }
}

/**
 * Define a module and execute it when all dependencies are resolved.
 */
function require(deps: string[], factory: (...args: {}[]) => void) {
  // We don't yet know our own module URL. We need to discover it so that we
  // can resolve our relative dependency specifiers. There are two ways the
  // script executing this define() call could have been loaded:

  // Case #1: We are a dependency of another module. A <script> was injected
  // to load us, but we don't yet know the URL that was used. Because
  // document.currentScript is not supported by IE, we communicate the URL via
  // a global callback. When finished executing, the "onload" event will be
  // fired by this <script>, which will be handled by the loading script,
  // which will invoke the callback with our module object.
  let pendingDefineCalled = false;
  registry.pendingDefine = function(mod) {
    pendingDefineCalled = true;
    registry.pendingDefine = undefined;
    mod.init(deps, factory);
  };

  // Case #2: We are a top-level script in the HTML document. Our URL is the
  // document's base URL. We can discover this case by waiting a tick, and if
  // we haven't already been defined by the "onload" handler from case #1,
  // then this must be case #2.
  setTimeout(function() {
    if (pendingDefineCalled === false) {
      const url = document.baseURI + '#' + registry.topLevelIdx++;
      const mod = registry.get(url);
      mod.loadStartedOrDone = true;
      if (registry.previousTopLevelUrl !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, inject a
        // dependency on the previous top-level script to preserve the
        // relative ordering.
        deps.push(registry.previousTopLevelUrl);
      }
      registry.previousTopLevelUrl = url;
      mod.init(deps, factory);
    }
  }, 0);
};

(window as any as {require: typeof require}).require = require;
})();
