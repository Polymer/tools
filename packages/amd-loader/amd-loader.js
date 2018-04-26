'use strict';

(function() {

var pendingInitCallback = undefined;
var topLevelIdx = 0;
var previousTopLevelUrl = undefined;

/**
 * Define a module and execute it when all dependencies are resolved.
 */
window.define = window.require = function(deps, factory) {
  // We don't yet know our own module URL. We need to discover it so that we can
  // resolve our relative dependency specifiers. There are two ways the script
  // executing this define() call could have been loaded:

  // Case #1: We are a dependency of another module. A <script> was injected to
  // load us, but we don't yet know the URL that was used. Scripts cannot
  // directly access their URL, so we rely on the script that loaded us to
  // inform us of the path it used.
  //
  // To do this, we register our init function to a global. Once this script has
  // finished executing, the "onload" event will be fired on this <script>, and
  // the script that loaded us will invoke our init function with the URL.
  var pendingInitCalled = false;
  pendingInitCallback = function(url) {
    pendingInitCalled = true;
    pendingInitCallback = undefined;
    lookupModule(url).init(deps, factory);
  };

  // Case #2: We are a top-level script in the HTML document. Our URL is the
  // document's base URL. We can discover this case by waiting a tick, and if we
  // haven't already been initialized by the "onload" handler from case #1, then
  // this must be case #2.
  setTimeout(function() {
    if (pendingInitCalled === false) {
      var url = document.baseURI + '#' + topLevelIdx++;
      var module = lookupModule(url);
      module.loadStartedOrDone = true;
      if (previousTopLevelUrl !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, inject a dependency
        // on the previous top-level script to preserve the relative ordering.
        deps.push(previousTopLevelUrl);
      }
      previousTopLevelUrl = url;
      module.init(deps, factory);
    }
  }, 0);
};

var registry = {};

function lookupModule(url) {
  var module = registry[url];
  if (module === undefined) {
    module = registry[url] = new Module(url);
  }
  return module;
}

function Module(url) {
  this.url = url;
  this.exports = {};
  this.loadStartedOrDone = false;
  // All of this module's dependencies are resolved and its factory has run.
  this.resolved = false;
  // Callbacks from dependents waiting to hear when this module has resolved.
  this.notify = [];
}

var resolverAnchor = document.createElement('a');

function resolveUrl(base, path) {
  if (path.indexOf('://') !== -1) {
    // Already a fully qualified URL.
    // TODO(aomarks) Is this a good enough check?
    return path;
  }
  // Just let the browser do path resolution/normalization.
  resolverAnchor.href = base + path;
  return resolverAnchor.href;
}

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

  var basePath = getBasePath(this.url);

  for (var i = 0; i < (deps || []).length; i++) {
    var depSpec = deps[i];

    if (depSpec === 'exports') {
      factoryArgs[i] = this.exports;

    } else if (depSpec === 'url') {
      // TODO(aomarks) This is an idea for replacing the import.meta transform.
      factoryArgs[i] = this.url;

    } else if (depSpec === 'require') {
      factoryArgs[i] = makeDynamicImporter(basePath);

    } else {
      var depUrl = resolveUrl(basePath, depSpec);
      var depModule = lookupModule(depUrl);
      factoryArgs[i] = depModule.exports;

      if (depModule.resolved === false) {
        numUnresolvedDeps++;
        depModule.notify.push(onDepResolved);

        if (depModule.loadStartedOrDone === false) {
          depModule.makeLoadScript();
        }
      }
    }
  }

  maybeResolve();
};

Module.prototype.makeLoadScript = function() {
  this.loadStartedOrDone = true;
  var script = document.createElement('script');
  var url = this.url;
  script.src = url;

  /// TODO(aomarks) Error handling.
  script.onload = function() {
    if (pendingInitCallback !== undefined) {
      pendingInitCallback(url);
    } else {
      // The script did not make a call to define(), otherwise the global
      // callback would have been set. That's fine, we can resolve it
      // immediately, because it doesn't have any dependencies.
      lookupModule(url).resolve();
    }
  };

  document.head.appendChild(script);
};

Module.prototype.resolve = function() {
  this.resolved = true;
  for (var i = 0; i < this.notify.length; i++) {
    this.notify[i]();
  }
};

function makeDynamicImporter(basePath) {
  return function dynamicImporter(spec, callback) {
    var url = resolveUrl(basePath, spec);
    var module = lookupModule(url);
    if (module.resolved === true) {
      callback(module.exports);
    } else {
      module.notify.push(function() {
        callback(module.exports);
      });
      if (module.loadStartedOrDone === false) {
        module.makeLoadScript();
      }
    }
  };
}

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
})();
