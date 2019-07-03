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
  define: ((deps: string[], moduleBody: OnExecutedCallback) => void)&{
    _reset?: () => void;
  };
  HTMLImports?:
      {importForElement: (element: Element) => HTMLLinkElement | undefined};
}

type OnExecutedCallback = (...args: Array<{}>) => void;
type onFailedCallback = (error: Error) => void;
type NormalizedUrl = string&{_normalized: never};

(function() {
if (window.define) {
  /* The loader was already loaded, make sure we don't reset it's state. */
  return;
}

// Set to true for more logging. Anything guarded by an
// `if (debugging)` check will not appear in the final output.
const debugging: boolean = false;

/**
 * Describes the state machine for loading a single module.
 *
 * At runtime, these are integers that are inlined in their use sites.
 */
const enum StateEnum {
  /**
   * The initial state.
   */
  Initialized = 'Initialized',

  /**
   * Comes after Initialized. We have begun loading the module over the network.
   * Top level scripts skip this state entirely.
   */
  Loading = 'Loading',

  /**
   * Comes after Loading. The module's <script> tag has loaded. If there was a
   * define() call for this module, it has run by now. We have started loading
   * the module's dependencies, but they can't be executed until
   * earlier modules have executed.
   *
   * Note that we only ever wait for things to execute.
   * We always load a module as soon as we can, and in no particular order.
   */
  WaitingForTurn = 'WaitingForTurn',

  /**
   * Comes after WaitingForTurn. All earlier scripts are now executed,
   * and we can now execute our dependencies in order. Only after that's done
   * can we execute this module.
   */
  WaitingOnDeps = 'WaitingOnDeps',

  /**
   * The successful terminal state. Comes after WaitingOnDeps. All of the
   * module's dependencies have loaded and executed, and the module's body, if
   * any, has executed, and there were no errors.
   */
  Executed = 'Executed',

  /**
   * The unsuccessful terminal state. Can come after any other state except
   * Executed. Indicates that either the module body threw an error, the
   * module's script failed to load (e.g. 404), or one of its dependencies
   * Failed.
   */
  Failed = 'Failed',
}

// Given a state, what additional data do we need to keep track of for a module
// at this state?
interface StateDataMap {
  [StateEnum.Initialized]: undefined;
  [StateEnum.Loading]: undefined;
  [StateEnum.WaitingForTurn]: WaitingData;
  [StateEnum.WaitingOnDeps]: WaitingData;
  [StateEnum.Executed]: undefined;
  [StateEnum.Failed]: Error;
}

/**
 * State that we need to keep track of while a module is loaded but waiting
 * to execute.
 */
interface WaitingData {
  /**
   * The dependencies of this module, in order.
   */
  readonly deps: Module[];
  /**
   * Args that we will pass into moduleBody.
   */
  readonly args: Array<{}>;
  /**
   * The body of the module, which is executed after its dependencies have
   * executed.
   *
   * In AMD/Commonjs terminology, this is the factory function.
   */
  readonly moduleBody: undefined|Function;
}

/**
 * Represents a module at a given state of the loading process.
 *
 * The Module/ModuleG distinction is a compromise in the TypeScript typings.
 * Use `Module` when a module's state must be checked at runtime,
 * `ModuleG<State>` for a module with a definite state. There is probably a
 * much better way to represent that.
 */
interface ModuleG<State extends keyof StateDataMap> {
  readonly url: NormalizedUrl;
  readonly urlBase: NormalizedUrl;
  readonly exports: {[id: string]: {}};
  /**
   * True if this is a top-level module.
   */
  isTopLevel: boolean;
  /**
   * Value of the `crossorigin` attribute that will be used to load this
   * module.
   */
  readonly crossorigin: string;
  /**
   * Callbacks that are called exactly once, for the next time the module
   * progresses to a new state.
   */
  readonly onNextStateChange: Array<() => void>;
  state: State;
  stateData: StateDataMap[State];
}

type Module = ModuleG<StateEnum.Initialized>|ModuleG<StateEnum.Loading>|
    ModuleG<StateEnum.WaitingForTurn>|ModuleG<StateEnum.WaitingOnDeps>|
    ModuleG<StateEnum.Executed>|ModuleG<StateEnum.Failed>;

/**
 * Transition the given module to the given state.
 *
 * Does not ensure that the transition is legal.
 * Calls onNextStateChange callbacks.
 */
function stateTransition<NewState extends StateEnum>(
    module: Module, newState: NewState, newStateData: StateDataMap[NewState]):
    ModuleG<NewState> {
  if (debugging) {
    console.log(`${module.url} transitioning to state ${newState}`);
  }
  const mutatedModule = module as ModuleG<NewState>;
  mutatedModule.state = newState;
  mutatedModule.stateData = newStateData;
  if (mutatedModule.onNextStateChange.length > 0) {
    const callbacks = mutatedModule.onNextStateChange.slice();
    mutatedModule.onNextStateChange.length = 0;
    for (const callback of callbacks) {
      callback();
    }
  }
  return mutatedModule;
}

/**
 * A global map from a fully qualified module URLs to module objects.
 */
const registry: {[url: string]: Module} = Object.create(null);
let pendingDefine: (() => [Array<string>, OnExecutedCallback | undefined])|
    undefined = undefined;
let topLevelScriptIdx = 0;
let previousTopLevelUrl: NormalizedUrl|undefined = undefined;
let baseUrl = getBaseUrl();

/** Begin loading a module from the network. */
function load(module: ModuleG<StateEnum.Initialized>):
    ModuleG<StateEnum.Loading> {
  const mutatedModule = stateTransition(module, StateEnum.Loading, undefined);

  const script = document.createElement('script');
  script.src = module.url;

  // Crossorigin attribute could be the empty string - preserve this.
  if (module.crossorigin !== null) {
    script.setAttribute('crossorigin', module.crossorigin);
  }

  /**
   * Remove our script tags from the document after they have loaded/errored, to
   * reduce the number of nodes. Since the file load order is arbitrary and not
   * the order in which we execute modules, these scripts aren't even helpful
   * for debugging, and they might give a false impression of the execution
   * order.
   */
  function removeScript() {
    try {
      document.head!.removeChild(script);
    } catch { /* Something else removed the script. We don't care. */
    }
  }

  script.onload = () => {
    let deps: string[], moduleBody;
    if (pendingDefine !== undefined) {
      [deps, moduleBody] = pendingDefine();
    } else {
      // The script did not make a call to define(), otherwise the global
      // callback would have been set. That's fine, we can execute immediately
      // because we can't have any dependencies.
      deps = [];
      moduleBody = undefined;
    }
    beginWaitingForTurn(mutatedModule, deps, moduleBody);
    removeScript();
  };

  script.onerror = () => {
    fail(module, new TypeError('Failed to fetch ' + module.url));
    removeScript();
  };

  document.head!.appendChild(script);

  return mutatedModule;
}

/** Start loading the module's dependencies, but don't execute anything yet. */
function beginWaitingForTurn(
    module: ModuleG<StateEnum.Loading>,
    deps: string[],
    moduleBody: OnExecutedCallback|undefined) {
  const [args, depModules] = loadDeps(module, deps);
  const stateData: WaitingData = {
    args,
    deps: depModules,
    moduleBody,
  };
  return stateTransition(module, StateEnum.WaitingForTurn, stateData);
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
          onExecuted?: OnExecutedCallback,
          onError?: onFailedCallback) {
        const [args, depModules] = loadDeps(module, deps);

        executeDependenciesInOrder(depModules, () => {
          if (onExecuted) {
            onExecuted.apply(null, args);
          }
        }, onError);
      });
      continue;
    }
    if (depSpec === 'meta') {
      args.push({
        // We append "#<script index>" to top-level scripts so that they have
        // unique keys in the registry. We don't want to see that here.
        url: (module.isTopLevel === true) ?
            module.url.substring(0, module.url.lastIndexOf('#')) :
            module.url
      });
      continue;
    }

    // We have a dependency on a real module.
    const dependency =
      getModule(resolveUrl(module.urlBase, depSpec), module.crossorigin);
    args.push(dependency.exports);
    depModules.push(dependency);

    if (dependency.state === StateEnum.Initialized) {
      load(dependency);
    }
  }
  return [args, depModules];
}

/**
 * Start executing our dependencies, in order, as they become available.
 * Once they're all executed, execute our own module body, if any.
 */
function beginWaitingOnDeps(module: ModuleG<StateEnum.WaitingForTurn>) {
  const mutatedModule =
      stateTransition(module, StateEnum.WaitingOnDeps, module.stateData);
  executeDependenciesInOrder(
      module.stateData.deps,
      () => execute(mutatedModule),
      (e) => fail(mutatedModule, e));
  return mutatedModule;
}

/** Runs the given module body. */
function execute(module: ModuleG<StateEnum.WaitingOnDeps>):
    ModuleG<StateEnum.Executed|StateEnum.Failed> {
  const stateData = module.stateData;
  if (stateData.moduleBody != null) {
    try {
      stateData.moduleBody.apply(null, stateData.args);
    } catch (e) {
      return fail(module, e);
    }
  }
  return stateTransition(module, StateEnum.Executed, undefined);
}

/**
 * Called when a module has failed to load, either becuase its script errored,
 * or because one of its transitive dependencies errored.
 */
function fail(mod: Module, error: Error) {
  if (mod.isTopLevel === true) {
    setTimeout(() => {
      // Top level modules have no way to handle errors other than throwing
      // an uncaught exception.
      throw error;
    });
  }
  return stateTransition(mod, StateEnum.Failed, error);
}

/**
 * @param deps The dependencies to execute, if they have not already executed.
 * @param onAllExecuted Called after all dependencies have executed.
 * @param onFailed Called if any dependency fails.
 */
function executeDependenciesInOrder(
    deps: Module[],
    onAllExecuted: OnExecutedCallback|undefined,
    onFailed: onFailedCallback|undefined): void {
  const nextDep = deps.shift();
  if (nextDep === undefined) {
    if (onAllExecuted) {
      onAllExecuted();
    }
    return;
  }

  if (nextDep.state === StateEnum.WaitingOnDeps) {
    if (debugging) {
      console.log(`Cycle detected while importing ${nextDep.url}`);
    }
    // Do not wait on the dep that introduces a cycle, continue on as though it
    // were not there.
    executeDependenciesInOrder(deps, onAllExecuted, onFailed);
    return;
  }

  waitForModuleWhoseTurnHasCome(nextDep, () => {
    executeDependenciesInOrder(deps, onAllExecuted, onFailed);
  }, onFailed);
}

/**
 * This method does two things: it waits for a module to execute, and it
 * will transition that module to WaitingOnDeps. This is the only place where we
 * transition a non-top-level module from WaitingForTurn to WaitingOnDeps.
 */
function waitForModuleWhoseTurnHasCome(
    dependency: Module, onExecuted: () => void, onFailed?: (e: Error) => void) {
  switch (dependency.state) {
    case StateEnum.WaitingForTurn:
      beginWaitingOnDeps(dependency);
      waitForModuleWhoseTurnHasCome(dependency, onExecuted, onFailed);
      return;

    case StateEnum.Failed:
      if (onFailed) {
        onFailed(dependency.stateData);
      }
      return;
    case StateEnum.Executed:
      onExecuted();
      return;

    // Nothing to do but wait
    case StateEnum.Loading:
    case StateEnum.WaitingOnDeps:
      dependency.onNextStateChange.push(
          () =>
              waitForModuleWhoseTurnHasCome(dependency, onExecuted, onFailed));
      return;

    // These cases should never happen.
    case StateEnum.Initialized:
      throw new Error(
          `All dependencies should be loading already before ` +
          `pressureDependencyToExecute is called.`);
    default:
      const never: never = dependency;
      throw new Error(`Impossible module state: ${(never as Module).state}`);
  }
}

/**
 * Define a module and execute its module body function when all dependencies
 * have executed.
 *
 * Dependencies must be specified as URLs, either relative or fully qualified
 * (e.g. "../foo.js" or "http://example.com/bar.js" but not "my-module-name").
 */
window.define = function(deps: string[], moduleBody?: OnExecutedCallback) {
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
    return [deps, moduleBody];
  };

  // Case #2: We are a top-level script in the HTML document or a HTML import.
  // Resolve the URL relative to the document url. We can discover this case
  // by waiting a tick, and if we haven't already been defined by the "onload"
  // handler from case #1, then this must be case #2.
  const documentUrl = getDocumentUrl();

  // Save the value of the crossorigin attribute before setTimeout while we
  // can still get document.currentScript. If not set, default to 'anonymous'
  // to match native <script type="module"> behavior. Note: IE11 doesn't
  // support the crossorigin attribute nor currentScript, so it will use the
  // default.
  const crossorigin = document.currentScript &&
      document.currentScript.getAttribute('crossorigin') || 'anonymous';

  setTimeout(() => {
    if (defined === false) {
      pendingDefine = undefined;
      const url = documentUrl + '#' + topLevelScriptIdx++ as NormalizedUrl;
      // It's actually Initialized, but we're skipping over the Loading
      // state, because this is a top level document and it's already loaded.
      const mod = getModule(url, crossorigin) as ModuleG<StateEnum.Loading>;
      mod.isTopLevel = true;
      const waitingModule = beginWaitingForTurn(mod, deps, moduleBody);
      if (previousTopLevelUrl !== undefined) {
        // type=module scripts execute in order (with the same timing as defer
        // scripts). Because this is a top-level script, and we are trying to
        // mirror type=module behavior as much as possible, wait for the
        // previous module script to finish (successfully or otherwise)
        // before executing further.
        whenModuleTerminated(getModule(previousTopLevelUrl), () => {
          beginWaitingOnDeps(waitingModule);
        });
      } else {
        beginWaitingOnDeps(waitingModule);
      }
      previousTopLevelUrl = url;
    }
  }, 0);
};

function whenModuleTerminated(module: Module, onTerminalState: () => void) {
  switch (module.state) {
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
function getModule(url: NormalizedUrl, crossorigin: string = 'anonymous') {
  let mod = registry[url];
  if (mod === undefined) {
    mod = registry[url] = {
      url,
      urlBase: getUrlBase(url),
      exports: Object.create(null),
      state: StateEnum.Initialized,
      stateData: undefined,
      isTopLevel: false,
      crossorigin,
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
 *  - /foo => http://example.com/foo
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
  return normalizeUrl(url[0] === '/' ? url : urlBase + url);
}

function getBaseUrl(): NormalizedUrl {
  // IE does not have document.baseURI.
  return (document.baseURI ||
          (document.querySelector('base') || window.location).href) as
      NormalizedUrl;
}

/**
 * Get the url of the current document. If the document is the main document,
 * the base url is returned. Otherwise if the module was imported by a HTML
 * import we need to resolve the URL relative to the HTML import.
 *
 * document.currentScript does not work in IE11, but the HTML import polyfill
 * mocks it when executing an import so for this case that's ok
 */
function getDocumentUrl() {
  const {currentScript} = document;
  // On IE11 document.currentScript is not defined when not in a HTML import
  if (!currentScript) {
    return baseUrl;
  }

  if (window.HTMLImports) {
    // When the HTMLImports polyfill is active, we can take the path from the
    // link element
    const htmlImport = window.HTMLImports.importForElement(currentScript);
    if (!htmlImport) {
      // If there is no import for the current script, we are in the index.html.
      // Take the base url.
      return baseUrl;
    }

    // Return the import href
    return htmlImport.href;
  } else {
    // On chrome's native implementation it's not possible to get a direct
    // reference to the link element, create an anchor and let the browser
    // resolve the url.
    const a = currentScript.ownerDocument!.createElement('a');
    a.href = '';
    return a.href;
  }
}
})();
