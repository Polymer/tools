/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

interface Window {
  define: ((deps: string[], factory: ResolveCallback) => void)&{
    _reset?: () => void;
  };
}

type ResolveCallback = (...args: Array<{}>) => void;
type ErrorCallback = (error: Error) => void;
type NormalizedUrl = string&{_normalized: never};

(function() {

/**
 * Describes the state loading state machine.
 *
 * At runtime, these are integers that are inlined in their use sites.
 */
const enum StateEnum {
  /**
   * The initial state.
   */
  Initialized,

  /**
   * Comes after Initialized. We have begun loading the module over the network.
   * Toplevel scripts skip this state entirely.
   */
  Loading,

  /**
   * Comes after Loading. The module's script has loaded and executed
   * successfully. We have started loading the module's dependencies, but we
   * can't execute them run until some other, earlier scripts have executed.
   */
  WaitingOnEarlierScripts,

  /**
   * Comes after WaitingOnEarlierScripts. All earlier scripts are now executed,
   * and we can now execute our dependencies in order. Once that's done, we can
   * execute this module too.
   */
  WaitingOnDeps,

  /**
   * The successful terminal state. Comes after WaitingOnDeps. All of the
   * module's dependencies have loaded and executed, and the module's body, if
   * any, has executed, and there were no errors.
   */
  Executed,

  /**
   * The unsuccessful terminal state. Something went wrong before we got to the
   * executed state.
   */
  Failed,
}

interface Initialized {
  state: StateEnum.Initialized;
}
interface Loading {
  state: StateEnum.Loading;
}
interface BaseWaiting {
  /**
   * The dependencies of this module, in order.
   */
  deps: Module[];
  /**
   * Args that we will pass into to moduleBody.
   */
  args: Array<{}>;
  /**
   * The body of the module, which is executed after its dependencies are
   * loaded.
   *
   * In AMD/Commonjs terminology, this is the factory function.
   */
  moduleBody: undefined|Function;
}
interface WaitingOnEarlierScripts extends BaseWaiting {
  state: StateEnum.WaitingOnEarlierScripts;
}
interface WaitingOnDeps extends BaseWaiting {
  state: StateEnum.WaitingOnDeps;
}
interface Executed {
  state: StateEnum.Executed;
}
interface Failed {
  state: StateEnum.Failed;
  readonly error: Error;
}
type ModuleStateData =
    Initialized|Loading|WaitingOnEarlierScripts|WaitingOnDeps|Executed|Failed;

interface Module<SD extends ModuleStateData = ModuleStateData> {
  url: NormalizedUrl;
  urlBase: NormalizedUrl;
  exports: {[id: string]: {}};
  stateData: SD;
  /** True if this is a top-level module. */
  isTopLevel: boolean;
  /**
   * Callbacks that are called exactly once, for the next time the module
   * progresses to a new state.
   */
  onNextStateChange: Array<() => void>;
}

/**
 * A global map from a fully qualified module URLs to module objects.
 */
const registry: {[url: string]: Module} = Object.create(null);
let pendingDefine: (() => [Array<string>, ResolveCallback | undefined])|
    undefined = undefined;
let topLevelScriptIdx = 0;
let previousTopLevelUrl: string|undefined = undefined;
let baseUrl = getBaseUrl();

/** Begin loading a module from the network. */
function load(module: Module<Initialized>): Module<Loading> {
  const mutatedModule = stateTransition(module, {state: StateEnum.Loading});

  const script = document.createElement('script');
  script.src = module.url;

  script.onload = () => {
    let deps: string[], moduleBody;
    if (pendingDefine !== undefined) {
      [deps, moduleBody] = pendingDefine();
    } else {
      // The script did not make a call to define(), otherwise the global
      // callback would have been set. That's fine, we can resolve immediately
      // because we don't have any dependencies, by definition.
      deps = [];
      moduleBody = undefined;
    }
    beginWaitingOnEarlierScripts(mutatedModule, deps, moduleBody);
  };

  script.onerror = () =>
      fail(module, new TypeError('Failed to fetch ' + module.url));

  document.head.appendChild(script);

  return mutatedModule;
}

/** Start loading the module's dependencies, but don't execute anything yet. */
function beginWaitingOnEarlierScripts(
    module: Module<Loading>,
    deps: string[],
    moduleBody: ResolveCallback|undefined) {
  const [args, depModules] = loadDeps(module, deps);
  const stateData: WaitingOnEarlierScripts = {
    state: StateEnum.WaitingOnEarlierScripts,
    args,
    deps: depModules,
    moduleBody,
  };
  return stateTransition(module, stateData);
}

function loadDeps(
    module: Module, depSpecifiers: string[]): [Array<{}>, Module[]] {
  const args: Array<{}> = [];
  const depModules: Module[] = [];
  for (const depSpec of depSpecifiers) {
    if (depSpec === 'exports') {
      args.push(module.exports);
      continue;
    }
    if (depSpec === 'require') {
      args.push(function(
          deps: string[],
          onResolve?: ResolveCallback,
          onError?: ErrorCallback) {
        const [args, depModules] = loadDeps(module, deps);

        waitOnDeps(depModules, () => {
          if (onResolve) {
            onResolve.apply(null, args);
          }
        }, onError);
      });
      continue;
    }
    if (depSpec === 'meta') {
      args.push({
        // We append "#<script index>" to top-level scripts so that they have
        // unique keys in the registry. We don't want to see that here.
        url: (module.isTopLevel === true) ? baseUrl : module.url
      });
      continue;
    }

    // We have a dependency on a real module.
    const dependency = getModule(resolveUrl(module.urlBase, depSpec));
    args.push(dependency.exports);
    depModules.push(dependency);

    if (dependency.stateData.state === StateEnum.Initialized) {
      load(dependency as Module<Initialized>);
    }
  }
  return [args, depModules];
}

/**
 * Start executing our dependencies, in order, as they become available.
 * Once they're all executed, execute our own module body, if any.
 */
function beginWaitingOnDeps(module: Module<WaitingOnEarlierScripts>) {
  const stateData: WaitingOnDeps = {
    state: StateEnum.WaitingOnDeps,
    args: module.stateData.args,
    deps: module.stateData.deps,
    moduleBody: module.stateData.moduleBody
  };
  const mutatedModule = stateTransition(module, stateData);
  waitOnDeps(
      module.stateData.deps,
      () => execute(mutatedModule),
      (e) => fail(mutatedModule, e));
  return mutatedModule;
}

/** Runs the given module body. */
function execute(module: Module<WaitingOnDeps>): Module<Executed|Failed> {
  const stateData = module.stateData;
  if (stateData.moduleBody != null) {
    try {
      stateData.moduleBody.apply(null, stateData.args);
    } catch (e) {
      return fail(module, e);
    }
  }
  return stateTransition(module, {state: StateEnum.Executed});
}

/**
 * Called when a module has failed to load, either becuase its script errored,
 * or because one of its transitive dependencies errored.
 */
function fail(mod: Module, error: Error) {
  return stateTransition(mod, {state: StateEnum.Failed, error});
}

/**
 * Transition the given module to the given state.
 *
 * Does not do any checking that the transition is legal.
 * Calls onNextStateChange callbacks.
 */
function stateTransition<SD extends ModuleStateData>(
    module: Module, stateData: SD): Module<SD> {
  const mutatedModule = module as Module<SD>;
  mutatedModule.stateData = stateData;
  if (mutatedModule.onNextStateChange.length > 0) {
    const callbacks = mutatedModule.onNextStateChange.slice();
    mutatedModule.onNextStateChange.length = 0;
    for (const callback of callbacks) {
      callback();
    }
  }
  return mutatedModule;
}

function waitOnDeps(
    deps: Module[],
    onResolve: ResolveCallback|undefined,
    onError: ErrorCallback|undefined): void {
  if (deps.length === 0) {
    if (onResolve) {
      onResolve();
    }
    return;
  }
  const nextDep = deps[0];
  switch (nextDep.stateData.state) {
    case StateEnum.Initialized:
      load(nextDep as Module<Initialized>);
      return;
    case StateEnum.WaitingOnEarlierScripts:
      beginWaitingOnDeps(nextDep as Module<WaitingOnEarlierScripts>);
      waitOnDeps(deps, onResolve, onError);
      return;
    case StateEnum.Failed:
      if (onError) {
        onError(nextDep.stateData.error);
      }
      return;
    case StateEnum.Executed:
      deps.shift();
      return waitOnDeps(deps, onResolve, onError);

    case StateEnum.Loading:
    case StateEnum.WaitingOnDeps:
      // Nothing for us to do but wait in this case.
      nextDep.onNextStateChange.push(
          () => waitOnDeps(deps, onResolve, onError));
      return;
    default:
      const never: never = nextDep.stateData;
      throw new Error(`Impossible module state: ${never}`);
  }
}

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
  pendingDefine = () => {
    defined = true;
    pendingDefine = undefined;
    return [deps, factory];
  };

  // Case #2: We are a top-level script in the HTML document. Our URL is the
  // document's base URL. We can discover this case by waiting a tick, and if
  // we haven't already been defined by the "onload" handler from case #1,
  // then this must be case #2.
  setTimeout(() => {
    if (defined === false) {
      pendingDefine = undefined;
      const url = baseUrl + '#' + topLevelScriptIdx++ as NormalizedUrl;
      const mod = getModule(url) as Module<Loading>;

      // Top-level scripts are already loaded.
      mod.isTopLevel = true;
      const predecessor = previousTopLevelUrl;
      previousTopLevelUrl = url;
      const waitingModule = beginWaitingOnEarlierScripts(mod, deps, factory);
      const nextStep = () => {
        beginWaitingOnDeps(waitingModule);
      };
      if (predecessor !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, wait for the
        // previous module script to finish (successfully or otherwise)
        // before executing further.
        whenModuleTerminated(getModule(predecessor as NormalizedUrl), nextStep);
      } else {
        nextStep();
      }
    }
  }, 0);
};

function whenModuleTerminated(module: Module, onTerminalState: () => void) {
  switch (module.stateData.state) {
    case StateEnum.Executed:
    case StateEnum.Failed:
      onTerminalState();
      return;
    default:
      module.onNextStateChange.push(
          () => whenModuleTerminated(module, onTerminalState));
  }
}

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
  baseUrl = getBaseUrl();
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
      stateData: {state: StateEnum.Initialized},
      isTopLevel: false,
      onNextStateChange: []
    };
  }
  return mod;
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

function getBaseUrl(): NormalizedUrl {
  // IE does not have document.baseURI.
  return (document.baseURI ||
          (document.querySelector('base') || window.location).href) as
      NormalizedUrl;
}
})();
