'use strict';

(function() {

function Registry() {
  this.modules = {};
  this.topLevelIdx = 0;
  this.previousTopLevelUrl = undefined;
  this.pendingDefine = undefined;
}

Registry.prototype.get = function(url) {
  var module = this.modules[url];
  if (module === undefined) {
    module = this.modules[url] = new Module(url);
  }
  return module;
};

var registry = new Registry();

function getBasePath(url) {
  // TODO(aomarks) Maybe a better way to do this.
  var lastSlash = url.lastIndexOf('/');
  if (lastSlash === url.indexOf('://') + 2) {
    // http://example.com -> http://example.com/
    return url + '/';
  }
  // http://example.com/foo/bar.html -> http://example.com/foo/
  return url.substring(0, lastSlash + 1);
}

function Module(url) {
  this.url = url;
  this.basePath = getBasePath(url);
  this.exports = {};
  this.loadStartedOrDone = false;
  // All of this module's dependencies are resolved and its factory has run.
  this.resolved = false;
  // Callbacks from dependents waiting to hear when this module has resolved.
  this.notify = [];
}

var resolverAnchor = document.createElement('a');

Module.prototype.init = function(deps, factory) {
  var factoryArgs = [];
  var numUnresolvedDeps = 0;

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
      // TODO(aomarks) This is an idea for replacing the import.meta transform.
      factoryArgs[i] = {url: this.url};

    } else {
      var depModule = registry.get(this.resolveUrl(depSpec));
      factoryArgs[i] = depModule.exports;

      if (depModule.resolved === false) {
        numUnresolvedDeps++;
        depModule.notify.push(onDepResolved);
        depModule.loadOnce();
      }
    }
  }

  maybeResolve();
};

Module.prototype.resolve = function() {
  this.resolved = true;
  for (var i = 0; i < this.notify.length; i++) {
    this.notify[i]();
  }
};

Module.resolverAnchor = document.createElement('a');

Module.prototype.resolveUrl = function(path) {
  if (path.indexOf('://') !== -1) {
    // Already a fully qualified URL.
    // TODO(aomarks) Is this a good enough check?
    return path;
  }
  // Just let the browser do path resolution/normalization.
  Module.resolverAnchor.href = this.basePath + path;
  return Module.resolverAnchor.href;
};

Module.prototype.makeDynamicImporter = function() {
  var resolveUrl = this.resolveUrl.bind(this);
  return function(spec, callback) {
    var module = registry.get(resolveUrl(spec));
    if (module.resolved === true) {
      callback(module.exports);
    } else {
      module.notify.push(function() {
        callback(module.exports);
      });
      module.loadOnce();
    }
  };
};

Module.prototype.loadOnce = function() {
  if (this.loadStartedOrDone === true) {
    return;
  }
  this.loadStartedOrDone = true;

  var script = document.createElement('script');
  script.src = this.url;

  var module = this;
  script.onload = function() {
    if (registry.pendingDefine !== undefined) {
      registry.pendingDefine(module);
    } else {
      // The script did not make a call to define(), otherwise the global
      // callback would have been set. That's fine, we can resolve it
      // immediately, because it doesn't have any dependencies.
      module.resolve();
    }
  };

  script.onerror = function() {
    throw new Error('error loading module', url);
  };

  document.head.appendChild(script);
};

/**
 * Define a module and execute it when all dependencies are resolved.
 */
window.define = function(deps, factory) {
  deps = deps || [];
  factory = factory || function() {};

  // We don't yet know our own module URL. We need to discover it so that we can
  // resolve our relative dependency specifiers. There are two ways the script
  // executing this define() call could have been loaded:

  // Case #1: We are a dependency of another module. A <script> was injected to
  // load us, but we don't yet know the URL that was used. Because
  // document.currentScript is not supported by IE, we communicate the URL via a
  // global callback. When finished executing, the "onload" event will be fired
  // by this <script>, which will be handled by the loading script, which will
  // invoke the callback with our module object.
  var pendingDefineCalled = false;
  registry.pendingDefine = function(module) {
    pendingDefineCalled = true;
    registry.pendingDefine = undefined;
    module.init(deps, factory);
  };

  // Case #2: We are a top-level script in the HTML document. Our URL is the
  // document's base URL. We can discover this case by waiting a tick, and if we
  // haven't already been defined by the "onload" handler from case #1, then
  // this must be case #2.
  setTimeout(function() {
    if (pendingDefineCalled === false) {
      var url = document.baseURI + '#' + registry.topLevelIdx++;
      var module = registry.get(url);
      module.loadStartedOrDone = true;
      if (registry.previousTopLevelUrl !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, inject a dependency
        // on the previous top-level script to preserve the relative ordering.
        deps.push(registry.previousTopLevelUrl);
      }
      registry.previousTopLevelUrl = url;
      module.init(deps, factory);
    }
  }, 0);
};
})();
