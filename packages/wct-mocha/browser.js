var WctMocha = (function () {
	'use strict';

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var helpers = createCommonjsModule(function (module, exports) {
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	// Make sure that we use native timers, in case they're being stubbed out.
	var nativeSetInterval = window.setInterval;
	var nativeSetTimeout = window.setTimeout;
	var nativeRequestAnimationFrame = window.requestAnimationFrame;
	/**
	 * Runs `stepFn`, catching any error and passing it to `callback` (Node-style).
	 * Otherwise, calls `callback` with no arguments on success.
	 *
	 * @param {function()} callback
	 * @param {function()} stepFn
	 */
	function safeStep(callback, stepFn) {
	    var err;
	    try {
	        stepFn();
	    }
	    catch (error) {
	        err = error;
	    }
	    callback(err);
	}
	exports.safeStep = safeStep;
	/**
	 * Runs your test at declaration time (before Mocha has begun tests). Handy for
	 * when you need to test document initialization.
	 *
	 * Be aware that any errors thrown asynchronously cannot be tied to your test.
	 * You may want to catch them and pass them to the done event, instead. See
	 * `safeStep`.
	 *
	 * @param {string} name The name of the test.
	 * @param {function(?function())} testFn The test function. If an argument is
	 *     accepted, the test will be treated as async, just like Mocha tests.
	 */
	function testImmediate(name, testFn) {
	    if (testFn.length > 0) {
	        return testImmediateAsync(name, testFn);
	    }
	    var err;
	    try {
	        testFn();
	    }
	    catch (error) {
	        err = error;
	    }
	    test(name, function (done) {
	        done(err);
	    });
	}
	exports.testImmediate = testImmediate;
	/**
	 * An async-only variant of `testImmediate`.
	 *
	 * @param {string} name
	 * @param {function(?function())} testFn
	 */
	function testImmediateAsync(name, testFn) {
	    var testComplete = false;
	    var err;
	    test(name, function (done) {
	        var intervalId = nativeSetInterval(function () {
	            if (!testComplete)
	                return;
	            clearInterval(intervalId);
	            done(err);
	        }, 10);
	    });
	    try {
	        testFn(function (error) {
	            if (error)
	                err = error;
	            testComplete = true;
	        });
	    }
	    catch (error) {
	        err = error;
	        testComplete = true;
	    }
	}
	exports.testImmediateAsync = testImmediateAsync;
	/**
	 * Triggers a flush of any pending events, observations, etc and calls you back
	 * after they have been processed.
	 *
	 * @param {function()} callback
	 */
	function flush(callback) {
	    // Ideally, this function would be a call to Polymer.dom.flush, but that
	    // doesn't support a callback yet
	    // (https://github.com/Polymer/polymer-dev/issues/851),
	    // ...and there's cross-browser flakiness to deal with.
	    // Make sure that we're invoking the callback with no arguments so that the
	    // caller can pass Mocha callbacks, etc.
	    var done = function done() {
	        callback();
	    };
	    // Because endOfMicrotask is flaky for IE, we perform microtask checkpoints
	    // ourselves (https://github.com/Polymer/polymer-dev/issues/114):
	    var isIE = navigator.appName === 'Microsoft Internet Explorer';
	    if (isIE && window.Platform && window.Platform.performMicrotaskCheckpoint) {
	        var reallyDone_1 = done;
	        done = function doneIE() {
	            Platform.performMicrotaskCheckpoint();
	            nativeSetTimeout(reallyDone_1, 0);
	        };
	    }
	    // Everyone else gets a regular flush.
	    var scope;
	    if (window.Polymer && window.Polymer.dom && window.Polymer.dom.flush) {
	        scope = window.Polymer.dom;
	    }
	    else if (window.Polymer && window.Polymer.flush) {
	        scope = window.Polymer;
	    }
	    else if (window.WebComponents && window.WebComponents.flush) {
	        scope = window.WebComponents;
	    }
	    if (scope) {
	        scope.flush();
	    }
	    // Ensure that we are creating a new _task_ to allow all active microtasks to
	    // finish (the code you're testing may be using endOfMicrotask, too).
	    nativeSetTimeout(done, 0);
	}
	exports.flush = flush;
	/**
	 * Advances a single animation frame.
	 *
	 * Calls `flush`, `requestAnimationFrame`, `flush`, and `callback` sequentially
	 * @param {function()} callback
	 */
	function animationFrameFlush(callback) {
	    flush(function () {
	        nativeRequestAnimationFrame(function () {
	            flush(callback);
	        });
	    });
	}
	exports.animationFrameFlush = animationFrameFlush;
	/**
	 * DEPRECATED: Use `flush`.
	 * @param {function} callback
	 */
	function asyncPlatformFlush(callback) {
	    console.warn('asyncPlatformFlush is deprecated in favor of the more terse flush()');
	    return window.flush(callback);
	}
	exports.asyncPlatformFlush = asyncPlatformFlush;
	/**
	 *
	 */
	function waitFor(fn, next, intervalOrMutationEl, timeout, timeoutTime) {
	    timeoutTime = timeoutTime || Date.now() + (timeout || 1000);
	    intervalOrMutationEl = intervalOrMutationEl || 32;
	    try {
	        fn();
	    }
	    catch (e) {
	        if (Date.now() > timeoutTime) {
	            throw e;
	        }
	        else {
	            if (typeof intervalOrMutationEl !== 'number') {
	                intervalOrMutationEl.onMutation(intervalOrMutationEl, function () {
	                    waitFor(fn, next, intervalOrMutationEl, timeout, timeoutTime);
	                });
	            }
	            else {
	                nativeSetTimeout(function () {
	                    waitFor(fn, next, intervalOrMutationEl, timeout, timeoutTime);
	                }, intervalOrMutationEl);
	            }
	            return;
	        }
	    }
	    next();
	}
	exports.waitFor = waitFor;
	window.safeStep = safeStep;
	window.testImmediate = testImmediate;
	window.testImmediateAsync = testImmediateAsync;
	window.flush = flush;
	window.animationFrameFlush = animationFrameFlush;
	window.asyncPlatformFlush = asyncPlatformFlush;
	window.waitFor = waitFor;

	});

	unwrapExports(helpers);
	var helpers_1 = helpers.safeStep;
	var helpers_2 = helpers.testImmediate;
	var helpers_3 = helpers.testImmediateAsync;
	var helpers_4 = helpers.flush;
	var helpers_5 = helpers.animationFrameFlush;
	var helpers_6 = helpers.asyncPlatformFlush;
	var helpers_7 = helpers.waitFor;

	var config = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */


	/**
	 * The global configuration state for WCT's browser client.
	 */
	exports._config = {
	    environmentScripts: [],
	    environmentImports: [],
	    root: null,
	    waitForFrameworks: true,
	    waitFor: null,
	    numConcurrentSuites: 1,
	    trackConsoleError: true,
	    mochaOptions: { timeout: 10 * 1000 },
	    verbose: false,
	};
	/**
	 * Merges initial `options` into WCT's global configuration.
	 *
	 * @param {Object} options The options to merge. See `browser/config.ts` for a
	 *     reference.
	 */
	function setup(options) {
	    var childRunner = childrunner.default.current();
	    if (childRunner) {
	        deepMerge(exports._config, childRunner.parentScope.WCT._config);
	        // But do not force the mocha UI
	        delete exports._config.mochaOptions.ui;
	    }
	    if (options && typeof options === 'object') {
	        deepMerge(exports._config, options);
	    }
	    if (!exports._config.root) {
	        // Sibling dependencies.
	        var root = util.scriptPrefix('browser.js');
	        exports._config.root = util.basePath(root.substr(0, root.length - 1));
	        if (!exports._config.root) {
	            throw new Error('Unable to detect root URL for WCT sources. Please set WCT.root before including browser.js');
	        }
	    }
	}
	exports.setup = setup;
	/**
	 * Retrieves a configuration value.
	 */
	function get(key) {
	    return exports._config[key];
	}
	exports.get = get;
	function deepMerge(target, source) {
	    Object.keys(source).forEach(function (key) {
	        if (target[key] !== null && typeof target[key] === 'object' &&
	            !Array.isArray(target[key])) {
	            deepMerge(target[key], source[key]);
	        }
	        else {
	            target[key] = source[key];
	        }
	    });
	}
	exports.deepMerge = deepMerge;

	});

	unwrapExports(config);
	var config_1 = config._config;
	var config_2 = config.setup;
	var config_3 = config.get;
	var config_4 = config.deepMerge;

	var util = createCommonjsModule(function (module, exports) {
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	Object.defineProperty(exports, "__esModule", { value: true });

	/**
	 * @param {function()} callback A function to call when the active web component
	 *     frameworks have loaded.
	 */
	function whenFrameworksReady(callback) {
	    debug('whenFrameworksReady');
	    var done = function () {
	        debug('whenFrameworksReady done');
	        callback();
	    };
	    // If webcomponents script is in the document, wait for WebComponentsReady.
	    if (window.WebComponents && !window.WebComponents.ready) {
	        debug('WebComponentsReady?');
	        window.addEventListener('WebComponentsReady', function wcReady() {
	            window.removeEventListener('WebComponentsReady', wcReady);
	            debug('WebComponentsReady');
	            done();
	        });
	    }
	    else {
	        done();
	    }
	}
	exports.whenFrameworksReady = whenFrameworksReady;
	/**
	 * @return {string} '<count> <kind> tests' or '<count> <kind> test'.
	 */
	function pluralizedStat(count, kind) {
	    if (count === 1) {
	        return count + ' ' + kind + ' test';
	    }
	    else {
	        return count + ' ' + kind + ' tests';
	    }
	}
	exports.pluralizedStat = pluralizedStat;
	/**
	 * @param {string} path The URI of the script to load.
	 * @param {function} done
	 */
	function loadScript(path, done) {
	    var script = document.createElement('script');
	    script.src = path;
	    if (done) {
	        script.onload = done.bind(null, null);
	        script.onerror = done.bind(null, 'Failed to load script ' + script.src);
	    }
	    document.head.appendChild(script);
	}
	exports.loadScript = loadScript;
	/**
	 * @param {string} path The URI of the stylesheet to load.
	 * @param {function} done
	 */
	function loadStyle(path, done) {
	    var link = document.createElement('link');
	    link.rel = 'stylesheet';
	    link.href = path;
	    if (done) {
	        link.onload = done.bind(null, null);
	        link.onerror = done.bind(null, 'Failed to load stylesheet ' + link.href);
	    }
	    document.head.appendChild(link);
	}
	exports.loadStyle = loadStyle;
	/**
	 * @param {...*} var_args Logs values to the console when the `debug`
	 *     configuration option is true.
	 */
	function debug() {
	    var var_args = [];
	    for (var _i = 0; _i < arguments.length; _i++) {
	        var_args[_i] = arguments[_i];
	    }
	    if (!config.get('verbose')) {
	        return;
	    }
	    var args = [window.location.pathname].concat(var_args);
	    (console.debug || console.log).apply(console, args);
	}
	exports.debug = debug;
	// URL Processing
	/**
	 * @param {string} url
	 * @return {{base: string, params: string}}
	 */
	function parseUrl(url) {
	    var parts = url.match(/^(.*?)(?:\?(.*))?$/);
	    return {
	        base: parts[1],
	        params: getParams(parts[2] || ''),
	    };
	}
	exports.parseUrl = parseUrl;
	/**
	 * Expands a URL that may or may not be relative to `base`.
	 *
	 * @param {string} url
	 * @param {string} base
	 * @return {string}
	 */
	function expandUrl(url, base) {
	    if (!base)
	        return url;
	    if (url.match(/^(\/|https?:\/\/)/))
	        return url;
	    if (base.substr(base.length - 1) !== '/') {
	        base = base + '/';
	    }
	    return base + url;
	}
	exports.expandUrl = expandUrl;
	/**
	 * @param {string=} opt_query A query string to parse.
	 * @return {!Object<string, !Array<string>>} All params on the URL's query.
	 */
	function getParams(query) {
	    query = typeof query === 'string' ? query : window.location.search;
	    if (query.substring(0, 1) === '?') {
	        query = query.substring(1);
	    }
	    // python's SimpleHTTPServer tacks a `/` on the end of query strings :(
	    if (query.slice(-1) === '/') {
	        query = query.substring(0, query.length - 1);
	    }
	    if (query === '')
	        return {};
	    var result = {};
	    query.split('&').forEach(function (part) {
	        var pair = part.split('=');
	        if (pair.length !== 2) {
	            console.warn('Invalid URL query part:', part);
	            return;
	        }
	        var key = decodeURIComponent(pair[0]);
	        var value = decodeURIComponent(pair[1]);
	        if (!result[key]) {
	            result[key] = [];
	        }
	        result[key].push(value);
	    });
	    return result;
	}
	exports.getParams = getParams;
	/**
	 * Merges params from `source` into `target` (mutating `target`).
	 *
	 * @param {!Object<string, !Array<string>>} target
	 * @param {!Object<string, !Array<string>>} source
	 */
	function mergeParams(target, source) {
	    Object.keys(source).forEach(function (key) {
	        if (!(key in target)) {
	            target[key] = [];
	        }
	        target[key] = target[key].concat(source[key]);
	    });
	}
	exports.mergeParams = mergeParams;
	/**
	 * @param {string} param The param to return a value for.
	 * @return {?string} The first value for `param`, if found.
	 */
	function getParam(param) {
	    var params = getParams();
	    return params[param] ? params[param][0] : null;
	}
	exports.getParam = getParam;
	/**
	 * @param {!Object<string, !Array<string>>} params
	 * @return {string} `params` encoded as a URI query.
	 */
	function paramsToQuery(params) {
	    var pairs = [];
	    Object.keys(params).forEach(function (key) {
	        params[key].forEach(function (value) {
	            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
	        });
	    });
	    return (pairs.length > 0) ? ('?' + pairs.join('&')) : '';
	}
	exports.paramsToQuery = paramsToQuery;
	function getPathName(location) {
	    return typeof location === 'string' ? location : location.pathname;
	}
	function basePath(location) {
	    return getPathName(location).match(/^.*\//)[0];
	}
	exports.basePath = basePath;
	function relativeLocation(location, basePath) {
	    var path = getPathName(location);
	    if (path.indexOf(basePath) === 0) {
	        path = path.substring(basePath.length);
	    }
	    return path;
	}
	exports.relativeLocation = relativeLocation;
	function cleanLocation(location) {
	    var path = getPathName(location);
	    if (path.slice(-11) === '/index.html') {
	        path = path.slice(0, path.length - 10);
	    }
	    return path;
	}
	exports.cleanLocation = cleanLocation;
	function parallel(runners, maybeLimit, done) {
	    var limit;
	    if (typeof maybeLimit !== 'number') {
	        done = maybeLimit;
	        limit = 0;
	    }
	    else {
	        limit = maybeLimit;
	    }
	    if (!runners.length) {
	        return done();
	    }
	    var called = false;
	    var total = runners.length;
	    var numActive = 0;
	    var numDone = 0;
	    function runnerDone(error) {
	        if (called) {
	            return;
	        }
	        numDone = numDone + 1;
	        numActive = numActive - 1;
	        if (error || numDone >= total) {
	            called = true;
	            done(error);
	        }
	        else {
	            runOne();
	        }
	    }
	    function runOne() {
	        if (limit && numActive >= limit) {
	            return;
	        }
	        if (!runners.length) {
	            return;
	        }
	        numActive = numActive + 1;
	        runners.shift()(runnerDone);
	    }
	    runners.forEach(runOne);
	}
	exports.parallel = parallel;
	/**
	 * Finds the directory that a loaded script is hosted on.
	 *
	 * @param {string} filename
	 * @return {string?}
	 */
	function scriptPrefix(filename) {
	    var scripts = document.querySelectorAll('script[src*="' + filename + '"]');
	    if (scripts.length !== 1) {
	        return null;
	    }
	    var script = scripts[0].src;
	    return script.substring(0, script.indexOf(filename));
	}
	exports.scriptPrefix = scriptPrefix;

	});

	unwrapExports(util);
	var util_1 = util.whenFrameworksReady;
	var util_2 = util.pluralizedStat;
	var util_3 = util.loadScript;
	var util_4 = util.loadStyle;
	var util_5 = util.debug;
	var util_6 = util.parseUrl;
	var util_7 = util.expandUrl;
	var util_8 = util.getParams;
	var util_9 = util.mergeParams;
	var util_10 = util.getParam;
	var util_11 = util.paramsToQuery;
	var util_12 = util.basePath;
	var util_13 = util.relativeLocation;
	var util_14 = util.cleanLocation;
	var util_15 = util.parallel;
	var util_16 = util.scriptPrefix;

	var childrunner = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * A Mocha suite (or suites) run within a child iframe, but reported as if they
	 * are part of the current context.
	 */
	var ChildRunner = /** @class */ (function () {
	    function ChildRunner(url, parentScope) {
	        this.eventListenersToRemoveOnClean = [];
	        this.parentScope = parentScope;
	        var urlBits = util.parseUrl(url);
	        util.mergeParams(urlBits.params, util.getParams(parentScope.location.search));
	        delete urlBits.params.cli_browser_id;
	        this.url = "" + urlBits.base + util.paramsToQuery(urlBits.params);
	        this.state = 'initializing';
	    }
	    /**
	     * Listeners added using this method will be removed on done()
	     *
	     * @param type event type
	     * @param listener object which receives a notification
	     * @param target event target
	     */
	    ChildRunner.prototype.addEventListener = function (type, listener, target) {
	        target.addEventListener(type, listener);
	        var descriptor = { target: target, type: type, listener: listener };
	        this.eventListenersToRemoveOnClean.push(descriptor);
	    };
	    /**
	     * Removes all event listeners added by a method addEventListener defined
	     * on an instance of ChildRunner.
	     */
	    ChildRunner.prototype.removeAllEventListeners = function () {
	        this.eventListenersToRemoveOnClean.forEach(function (_a) {
	            var target = _a.target, type = _a.type, listener = _a.listener;
	            return target.removeEventListener(type, listener);
	        });
	    };
	    /**
	     * @return {ChildRunner} The `ChildRunner` that was registered for this
	     * window.
	     */
	    ChildRunner.current = function () {
	        return ChildRunner.get(window);
	    };
	    /**
	     * @param {!Window} target A window to find the ChildRunner of.
	     * @param {boolean} traversal Whether this is a traversal from a child window.
	     * @return {ChildRunner} The `ChildRunner` that was registered for `target`.
	     */
	    ChildRunner.get = function (target, traversal) {
	        var childRunner = ChildRunner.byUrl[target.location.href];
	        if (childRunner) {
	            return childRunner;
	        }
	        if (window.parent === window) {
	            // Top window.
	            if (traversal) {
	                console.warn('Subsuite loaded but was never registered. This most likely is due to wonky history behavior. Reloading...');
	                window.location.reload();
	            }
	            return null;
	        }
	        // Otherwise, traverse.
	        return window.parent.WCT._ChildRunner.get(target, true);
	    };
	    /**
	     * Loads and runs the subsuite.
	     *
	     * @param {function} done Node-style callback.
	     */
	    ChildRunner.prototype.run = function (done) {
	        var _this = this;
	        util.debug('ChildRunner#run', this.url);
	        this.state = 'loading';
	        this.onRunComplete = done;
	        this.container = document.getElementById('subsuites');
	        if (!this.container) {
	            var container_1 = (this.container = document.createElement('div'));
	            container_1.id = 'subsuites';
	            document.body.appendChild(container_1);
	        }
	        var container = this.container;
	        var iframe = (this.iframe = document.createElement('iframe'));
	        iframe.classList.add('subsuite');
	        iframe.src = this.url;
	        // Let the iframe expand the URL for us.
	        var url = (this.url = iframe.src);
	        container.appendChild(iframe);
	        ChildRunner.byUrl[url] = this;
	        this.timeoutId = window.setTimeout(function () { return _this.loaded(new Error('Timed out loading ' + url)); }, ChildRunner.loadTimeout);
	        this.addEventListener('error', function () { return _this.loaded(new Error('Failed to load document ' + _this.url)); }, iframe);
	        this.addEventListener('DOMContentLoaded', function () { return _this.loaded(); }, iframe.contentWindow);
	    };
	    /**
	     * Called when the sub suite's iframe has loaded (or errored during load).
	     *
	     * @param {*} error The error that occured, if any.
	     */
	    ChildRunner.prototype.loaded = function (error) {
	        util.debug('ChildRunner#loaded', this.url, error);
	        if (this.iframe.contentWindow == null && error) {
	            this.signalRunComplete(error);
	            this.done();
	            return;
	        }
	        // Not all targets have WCT loaded (compatiblity mode)
	        if (this.iframe.contentWindow.WCT) {
	            this.share = this.iframe.contentWindow.WCT.share;
	        }
	        if (error) {
	            this.signalRunComplete(error);
	            this.done();
	        }
	    };
	    /**
	     * Called in mocha/run.js when all dependencies have loaded, and the child is
	     * ready to start running tests
	     *
	     * @param {*} error The error that occured, if any.
	     */
	    ChildRunner.prototype.ready = function (error) {
	        util.debug('ChildRunner#ready', this.url, error);
	        if (this.timeoutId) {
	            clearTimeout(this.timeoutId);
	        }
	        if (error) {
	            this.signalRunComplete(error);
	            this.done();
	        }
	    };
	    /**
	     * Called when the sub suite's tests are complete, so that it can clean up.
	     */
	    ChildRunner.prototype.done = function () {
	        var _this = this;
	        util.debug('ChildRunner#done', this.url, arguments);
	        // Make sure to clear that timeout.
	        this.ready();
	        this.signalRunComplete();
	        if (this.iframe) {
	            // Be safe and avoid potential browser crashes when logic attempts to
	            // interact with the removed iframe.
	            setTimeout(function () {
	                _this.removeAllEventListeners();
	                _this.container.removeChild(_this.iframe);
	                _this.iframe = undefined;
	                _this.share = null;
	            }, 0);
	        }
	    };
	    ChildRunner.prototype.signalRunComplete = function (error) {
	        if (this.onRunComplete) {
	            this.state = 'complete';
	            this.onRunComplete(error);
	            this.onRunComplete = null;
	        }
	    };
	    // ChildRunners get a pretty generous load timeout by default.
	    ChildRunner.loadTimeout = 60000;
	    // We can't maintain properties on iframe elements in Firefox/Safari/???, so
	    // we track childRunners by URL.
	    ChildRunner.byUrl = {};
	    return ChildRunner;
	}());
	exports.default = ChildRunner;

	});

	unwrapExports(childrunner);

	var clisocket = createCommonjsModule(function (module, exports) {
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	Object.defineProperty(exports, "__esModule", { value: true });


	var SOCKETIO_ENDPOINT = window.location.protocol + '//' + window.location.host;
	var SOCKETIO_LIBRARY = SOCKETIO_ENDPOINT + '/socket.io/socket.io.js';
	/**
	 * A socket for communication between the CLI and browser runners.
	 *
	 * @param {string} browserId An ID generated by the CLI runner.
	 * @param {!io.Socket} socket The socket.io `Socket` to communicate over.
	 */
	var CLISocket = /** @class */ (function () {
	    function CLISocket(browserId, socket) {
	        this.browserId = browserId;
	        this.socket = socket;
	    }
	    /**
	     * @param {!Mocha.Runner} runner The Mocha `Runner` to observe, reporting
	     *     interesting events back to the CLI runner.
	     */
	    CLISocket.prototype.observe = function (runner) {
	        var _this = this;
	        this.emitEvent('browser-start', {
	            url: window.location.toString(),
	        });
	        // We only emit a subset of events that we care about, and follow a more
	        // general event format that is hopefully applicable to test runners beyond
	        // mocha.
	        //
	        // For all possible mocha events, see:
	        // https://github.com/visionmedia/mocha/blob/master/lib/runner.js#L36
	        runner.on('test', function (test) {
	            _this.emitEvent('test-start', { test: getTitles(test) });
	        });
	        runner.on('test end', function (test) {
	            _this.emitEvent('test-end', {
	                state: getState(test),
	                test: getTitles(test),
	                duration: test.duration,
	                error: test.err,
	            });
	        });
	        runner.on('fail', function (test, err) {
	            // fail the test run if we catch errors outside of a test function
	            if (test.type !== 'test') {
	                _this.emitEvent('browser-fail', 'Error thrown outside of test function: ' + err.stack);
	            }
	        });
	        runner.on('childRunner start', function (childRunner) {
	            _this.emitEvent('sub-suite-start', childRunner.share);
	        });
	        runner.on('childRunner end', function (childRunner) {
	            _this.emitEvent('sub-suite-end', childRunner.share);
	        });
	        runner.on('end', function () {
	            _this.emitEvent('browser-end');
	        });
	    };
	    /**
	     * @param {string} event The name of the event to fire.
	     * @param {*} data Additional data to pass with the event.
	     */
	    CLISocket.prototype.emitEvent = function (event, data) {
	        this.socket.emit('client-event', {
	            browserId: this.browserId,
	            event: event,
	            data: data,
	        });
	    };
	    /**
	     * Builds a `CLISocket` if we are within a CLI-run environment; short-circuits
	     * otherwise.
	     *
	     * @param {function(*, CLISocket)} done Node-style callback.
	     */
	    CLISocket.init = function (done) {
	        var browserId = util.getParam('cli_browser_id');
	        if (!browserId) {
	            return done();
	        }
	        // Only fire up the socket for root runners.
	        if (childrunner.default.current()) {
	            return done();
	        }
	        util.loadScript(SOCKETIO_LIBRARY, function (error) {
	            if (error) {
	                return done(error);
	            }
	            var server = io(SOCKETIO_ENDPOINT);
	            // WTF(usergenic): The typings are super wrong or something.  The object
	            // returned by io() doesn't seem to map to the SocketIO.Server type at
	            // all.
	            var sockets = server; // server.sockets;
	            var errorListener = function (error) {
	                sockets.off('error', errorListener);
	                done(error);
	            };
	            sockets.on('error', errorListener);
	            var connectListener = function () {
	                sockets.off('connect', connectListener);
	                done(null, new CLISocket(browserId, sockets));
	            };
	            sockets.on('connect', connectListener);
	        });
	    };
	    return CLISocket;
	}());
	exports.default = CLISocket;
	// Misc Utility
	/**
	 * @param {!Mocha.Runnable} runnable The test or suite to extract titles from.
	 * @return {!Array.<string>} The titles of the runnable and its parents.
	 */
	function getTitles(runnable) {
	    var titles = [];
	    while (runnable && !runnable.root && runnable.title) {
	        titles.unshift(runnable.title);
	        runnable = runnable.parent;
	    }
	    return titles;
	}
	/**
	 * @param {!Mocha.Runnable} runnable
	 * @return {string}
	 */
	function getState(runnable) {
	    if (runnable.state === 'passed') {
	        return 'passing';
	    }
	    else if (runnable.state === 'failed') {
	        return 'failing';
	    }
	    else if (runnable.pending) {
	        return 'pending';
	    }
	    else {
	        return 'unknown';
	    }
	}

	});

	unwrapExports(clisocket);

	var console_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */

	// We capture console events when running tests; so make sure we have a
	// reference to the original one.
	var console = window.console;
	var FONT = ';font: normal 13px "Roboto", "Helvetica Neue", "Helvetica", sans-serif;';
	var STYLES = {
	    plain: FONT,
	    suite: 'color: #5c6bc0' + FONT,
	    test: FONT,
	    passing: 'color: #259b24' + FONT,
	    pending: 'color: #e65100' + FONT,
	    failing: 'color: #c41411' + FONT,
	    stack: 'color: #c41411',
	    results: FONT + 'font-size: 16px',
	};
	// I don't think we can feature detect this one...
	var userAgent = navigator.userAgent.toLowerCase();
	var CAN_STYLE_LOG = userAgent.match('firefox') || userAgent.match('webkit');
	var CAN_STYLE_GROUP = userAgent.match('webkit');
	// Track the indent for faked `console.group`
	var logIndent = '';
	function log(text, style) {
	    text = text.split('\n')
	        .map(function (l) {
	        return logIndent + l;
	    })
	        .join('\n');
	    if (CAN_STYLE_LOG) {
	        console.log('%c' + text, STYLES[style] || STYLES.plain);
	    }
	    else {
	        console.log(text);
	    }
	}
	function logGroup(text, style) {
	    if (CAN_STYLE_GROUP) {
	        console.group('%c' + text, STYLES[style] || STYLES.plain);
	    }
	    else if (console.group) {
	        console.group(text);
	    }
	    else {
	        logIndent = logIndent + '  ';
	        log(text, style);
	    }
	}
	function logGroupEnd() {
	    if (console.groupEnd) {
	        console.groupEnd();
	    }
	    else {
	        logIndent = logIndent.substr(0, logIndent.length - 2);
	    }
	}
	function logException(error) {
	    log(error.stack || error.message || (error + ''), 'stack');
	}
	/**
	 * A Mocha reporter that logs results out to the web `console`.
	 */
	var Console = /** @class */ (function () {
	    /**
	     * @param runner The runner that is being reported on.
	     */
	    function Console(runner) {
	        Mocha.reporters.Base.call(this, runner);
	        runner.on('suite', function (suite) {
	            if (suite.root) {
	                return;
	            }
	            logGroup(suite.title, 'suite');
	        }.bind(this));
	        runner.on('suite end', function (suite) {
	            if (suite.root) {
	                return;
	            }
	            logGroupEnd();
	        }.bind(this));
	        runner.on('test', function (test) {
	            logGroup(test.title, 'test');
	        }.bind(this));
	        runner.on('pending', function (test) {
	            logGroup(test.title, 'pending');
	        }.bind(this));
	        runner.on('fail', function (_test, error) {
	            logException(error);
	        }.bind(this));
	        runner.on('test end', function (_test) {
	            logGroupEnd();
	        }.bind(this));
	        runner.on('end', this.logSummary.bind(this));
	    }
	    /** Prints out a final summary of test results. */
	    Console.prototype.logSummary = function () {
	        logGroup('Test Results', 'results');
	        if (this.stats.failures > 0) {
	            log(util.pluralizedStat(this.stats.failures, 'failing'), 'failing');
	        }
	        if (this.stats.pending > 0) {
	            log(util.pluralizedStat(this.stats.pending, 'pending'), 'pending');
	        }
	        log(util.pluralizedStat(this.stats.passes, 'passing'));
	        if (!this.stats.failures) {
	            log('test suite passed', 'passing');
	        }
	        log('Evaluated ' + this.stats.tests + ' tests in ' +
	            this.stats.duration + 'ms.');
	        logGroupEnd();
	    };
	    return Console;
	}());
	exports.default = Console;

	});

	unwrapExports(console_1);

	var html = createCommonjsModule(function (module, exports) {
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * WCT-specific behavior on top of Mocha's default HTML reporter.
	 *
	 * @param {!Mocha.Runner} runner The runner that is being reported on.
	 */
	function HTML(runner) {
	    var output = document.createElement('div');
	    output.id = 'mocha';
	    document.body.appendChild(output);
	    runner.on('suite', function (_test) {
	        this.total = runner.total;
	    }.bind(this));
	    Mocha.reporters.HTML.call(this, runner);
	}
	exports.default = HTML;
	// Woo! What a hack. This just saves us from adding a bunch of complexity around
	// style loading.
	var style = document.createElement('style');
	style.textContent = "\n    html, body {\n      position: relative;\n      height: 100%;\n      width:  100%;\n      min-width: 900px;\n    }\n    #mocha, #subsuites {\n      height: 100%;\n      position: absolute;\n      top: 0;\n    }\n    #mocha {\n      box-sizing: border-box;\n      margin: 0 !important;\n      padding: 60px 20px;\n      right: 0;\n      left: 500px;\n    }\n    #subsuites {\n      -ms-flex-direction: column;\n      -webkit-flex-direction: column;\n      display: -ms-flexbox;\n      display: -webkit-flex;\n      display: flex;\n      flex-direction: column;\n      left: 0;\n      width: 500px;\n    }\n    #subsuites .subsuite {\n      border: 0;\n      width: 100%;\n      height: 100%;\n    }\n    #mocha .test.pass .duration {\n      color: #555 !important;\n    }\n";
	document.head.appendChild(style);

	});

	unwrapExports(html);

	var parsing = createCommonjsModule(function (module, exports) {
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 *
	 * This code may only be used under the BSD style license found at
	 * polymer.github.io/LICENSE.txt The complete set of authors may be found at
	 * polymer.github.io/AUTHORS.txt The complete set of contributors may be found
	 * at polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as part of
	 * the polymer project is also subject to an additional IP rights grant found at
	 * polymer.github.io/PATENTS.txt
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	function parse(stack) {
	    var rawLines = stack.split('\n');
	    var stackyLines = compact(rawLines.map(parseStackyLine));
	    if (stackyLines.length === rawLines.length)
	        return stackyLines;
	    var v8Lines = compact(rawLines.map(parseV8Line));
	    if (v8Lines.length > 0)
	        return v8Lines;
	    var geckoLines = compact(rawLines.map(parseGeckoLine));
	    if (geckoLines.length > 0)
	        return geckoLines;
	    throw new Error('Unknown stack format: ' + stack);
	}
	exports.parse = parse;
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack
	var GECKO_LINE = /^(?:([^@]*)@)?(.*?):(\d+)(?::(\d+))?$/;
	function parseGeckoLine(line) {
	    var match = line.match(GECKO_LINE);
	    if (!match)
	        return null;
	    return {
	        method: match[1] || '',
	        location: match[2] || '',
	        line: parseInt(match[3]) || 0,
	        column: parseInt(match[4]) || 0,
	    };
	}
	exports.parseGeckoLine = parseGeckoLine;
	// https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
	var V8_OUTER1 = /^\s*(eval )?at (.*) \((.*)\)$/;
	var V8_OUTER2 = /^\s*at()() (\S+)$/;
	var V8_INNER = /^\(?([^\(]+):(\d+):(\d+)\)?$/;
	function parseV8Line(line) {
	    var outer = line.match(V8_OUTER1) || line.match(V8_OUTER2);
	    if (!outer) {
	        return null;
	    }
	    var inner = outer[3].match(V8_INNER);
	    if (!inner) {
	        return null;
	    }
	    var method = outer[2] || '';
	    if (outer[1]) {
	        method = 'eval at ' + method;
	    }
	    return {
	        method: method,
	        location: inner[1] || '',
	        line: parseInt(inner[2]) || 0,
	        column: parseInt(inner[3]) || 0,
	    };
	}
	exports.parseV8Line = parseV8Line;
	var STACKY_LINE = /^\s*(.+) at (.+):(\d+):(\d+)$/;
	function parseStackyLine(line) {
	    var match = line.match(STACKY_LINE);
	    if (!match)
	        return null;
	    return {
	        method: match[1] || '',
	        location: match[2] || '',
	        line: parseInt(match[3]) || 0,
	        column: parseInt(match[4]) || 0,
	    };
	}
	exports.parseStackyLine = parseStackyLine;
	// Helpers
	function compact(array) {
	    var result = [];
	    array.forEach(function (value) { return value && result.push(value); });
	    return result;
	}

	});

	unwrapExports(parsing);
	var parsing_1 = parsing.parse;
	var parsing_2 = parsing.parseGeckoLine;
	var parsing_3 = parsing.parseV8Line;
	var parsing_4 = parsing.parseStackyLine;

	var formatting = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 *
	 * This code may only be used under the BSD style license found at
	 * polymer.github.io/LICENSE.txt The complete set of authors may be found at
	 * polymer.github.io/AUTHORS.txt The complete set of contributors may be found
	 * at polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as part of
	 * the polymer project is also subject to an additional IP rights grant found at
	 * polymer.github.io/PATENTS.txt
	 */

	exports.defaults = {
	    maxMethodPadding: 40,
	    indent: '',
	    methodPlaceholder: '<unknown>',
	    locationStrip: [],
	    unimportantLocation: [],
	    filter: function () {
	        return false;
	    },
	    styles: {
	        method: passthrough,
	        location: passthrough,
	        line: passthrough,
	        column: passthrough,
	        unimportant: passthrough,
	    },
	};
	function pretty(stackOrParsed, options) {
	    options = mergeDefaults(options || {}, exports.defaults);
	    var lines = Array.isArray(stackOrParsed) ? stackOrParsed : parsing.parse(stackOrParsed);
	    lines = clean(lines, options);
	    var padSize = methodPadding(lines, options);
	    var parts = lines.map(function (line) {
	        var method = line.method || options.methodPlaceholder;
	        var pad = options.indent + padding(padSize - method.length);
	        var locationBits = [
	            options.styles.location(line.location),
	            options.styles.line(line.line.toString()),
	        ];
	        if ('column' in line) {
	            locationBits.push(options.styles.column(line.column.toString()));
	        }
	        var location = locationBits.join(':');
	        var text = pad + options.styles.method(method) + ' at ' + location;
	        if (!line.important) {
	            text = options.styles.unimportant(text);
	        }
	        return text;
	    });
	    return parts.join('\n');
	}
	exports.pretty = pretty;
	function clean(lines, options) {
	    var result = [];
	    for (var i = 0, line; line = lines[i]; i++) {
	        if (options.filter(line))
	            continue;
	        line.location = cleanLocation(line.location, options);
	        line.important = isImportant(line, options);
	        result.push(line);
	    }
	    return result;
	}
	// Utility
	function passthrough(text) {
	    return text;
	}
	function mergeDefaults(options, defaults) {
	    var result = Object.create(defaults);
	    Object.keys(options).forEach(function (key) {
	        var value = options[key];
	        if (typeof value === 'object' && !Array.isArray(value)) {
	            value = mergeDefaults(value, defaults[key]);
	        }
	        result[key] = value;
	    });
	    return result;
	}
	function methodPadding(lines, options) {
	    var size = options.methodPlaceholder.length;
	    for (var i = 0, line; line = lines[i]; i++) {
	        size =
	            Math.min(options.maxMethodPadding, Math.max(size, line.method.length));
	    }
	    return size;
	}
	function padding(length) {
	    var result = '';
	    for (var i = 0; i < length; i++) {
	        result = result + ' ';
	    }
	    return result;
	}
	function cleanLocation(location, options) {
	    if (options.locationStrip) {
	        for (var i = 0, matcher; matcher = options.locationStrip[i]; i++) {
	            location = location.replace(matcher, '');
	        }
	    }
	    return location;
	}
	function isImportant(line, options) {
	    if (options.unimportantLocation) {
	        for (var i = 0, matcher; matcher = options.unimportantLocation[i]; i++) {
	            if (line.location.match(matcher))
	                return false;
	        }
	    }
	    return true;
	}

	});

	unwrapExports(formatting);
	var formatting_1 = formatting.defaults;
	var formatting_2 = formatting.pretty;

	var normalization = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 *
	 * This code may only be used under the BSD style license found at
	 * polymer.github.io/LICENSE.txt The complete set of authors may be found at
	 * polymer.github.io/AUTHORS.txt The complete set of contributors may be found
	 * at polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as part of
	 * the polymer project is also subject to an additional IP rights grant found at
	 * polymer.github.io/PATENTS.txt
	 */


	function normalize(error, prettyOptions) {
	    if (error.parsedStack) {
	        return error;
	    }
	    var message = error.message || error.description || error || '<unknown error>';
	    var parsedStack = [];
	    try {
	        parsedStack = parsing.parse(error.stack || error.toString());
	    }
	    catch (error) {
	        // Ah well.
	    }
	    if (parsedStack.length === 0 && error.fileName) {
	        parsedStack.push({
	            method: '',
	            location: error.fileName,
	            line: error.lineNumber,
	            column: error.columnNumber,
	        });
	    }
	    if (!prettyOptions || !prettyOptions.showColumns) {
	        for (var i = 0, line; line = parsedStack[i]; i++) {
	            delete line.column;
	        }
	    }
	    var prettyStack = message;
	    if (parsedStack.length > 0) {
	        prettyStack = prettyStack + '\n' + formatting.pretty(parsedStack, prettyOptions);
	    }
	    var cleanErr = Object.create(Error.prototype);
	    cleanErr.message = message;
	    cleanErr.stack = prettyStack;
	    cleanErr.parsedStack = parsedStack;
	    return cleanErr;
	}
	exports.normalize = normalize;

	});

	unwrapExports(normalization);
	var normalization_1 = normalization.normalize;

	var multi = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */


	var STACKY_CONFIG = {
	    indent: '  ',
	    locationStrip: [
	        /^https?:\/\/[^\/]+/,
	        /\?.*$/,
	    ],
	    filter: function (line) {
	        return !!line.location.match(/\/web-component-tester\/[^\/]+(\?.*)?$/);
	    },
	};
	// https://github.com/visionmedia/mocha/blob/master/lib/runner.js#L36-46
	var MOCHA_EVENTS = [
	    'start',
	    'end',
	    'suite',
	    'suite end',
	    'test',
	    'test end',
	    'hook',
	    'hook end',
	    'pass',
	    'fail',
	    'pending',
	    'childRunner end'
	];
	// Until a suite has loaded, we assume this many tests in it.
	var ESTIMATED_TESTS_PER_SUITE = 3;
	/**
	 * A Mocha-like reporter that combines the output of multiple Mocha suites.
	 */
	var MultiReporter = /** @class */ (function () {
	    /**
	     * @param numSuites The number of suites that will be run, in order to
	     *     estimate the total number of tests that will be performed.
	     * @param reporters The set of reporters that
	     *     should receive the unified event stream.
	     * @param parent The parent reporter, if present.
	     */
	    function MultiReporter(numSuites, reporters, parent) {
	        var _this = this;
	        this.reporters = reporters.map(function (reporter) {
	            return new reporter(_this);
	        });
	        this.parent = parent;
	        this.basePath = parent && parent.basePath || util.basePath(window.location);
	        this.total = numSuites * ESTIMATED_TESTS_PER_SUITE;
	        // Mocha reporters assume a stream of events, so we have to be careful to
	        // only report on one runner at a time...
	        this.currentRunner = null;
	        // ...while we buffer events for any other active runners.
	        this.pendingEvents = [];
	        this.emit('start');
	    }
	    /**
	     * @param location The location this reporter represents.
	     * @return A reporter-like "class" for each child suite
	     *     that should be passed to `mocha.run`.
	     */
	    MultiReporter.prototype.childReporter = function (location) {
	        var _a;
	        var name = this.suiteTitle(location);
	        // The reporter is used as a constructor, so we can't depend on `this` being
	        // properly bound.
	        var self = this;
	        return _a = /** @class */ (function () {
	                function ChildReporter(runner) {
	                    runner.name = window.name;
	                    self.bindChildRunner(runner);
	                }
	                return ChildReporter;
	            }()),
	            _a.title = window.name,
	            _a;
	    };
	    /** Must be called once all runners have finished. */
	    MultiReporter.prototype.done = function () {
	        this.complete = true;
	        this.flushPendingEvents();
	        this.emit('end');
	    };
	    MultiReporter.prototype.epilogue = function () {
	    };
	    /**
	     * Emit a top level test that is not part of any suite managed by this
	     * reporter.
	     *
	     * Helpful for reporting on global errors, loading issues, etc.
	     *
	     * @param title The title of the test.
	     * @param error An error associated with this test. If falsy, test is
	     *     considered to be passing.
	     * @param suiteTitle Title for the suite that's wrapping the test.
	     * @param estimated If this test was included in the original
	     *     estimate of `numSuites`.
	     */
	    MultiReporter.prototype.emitOutOfBandTest = function (title, error, suiteTitle, estimated) {
	        util.debug('MultiReporter#emitOutOfBandTest(', arguments, ')');
	        var root = new Mocha.Suite(suiteTitle || '');
	        var test = new Mocha.Test(title, function () { });
	        test.parent = root;
	        test.state = error ? 'failed' : 'passed';
	        test.err = error;
	        if (!estimated) {
	            this.total = this.total + ESTIMATED_TESTS_PER_SUITE;
	        }
	        var runner = { total: 1 };
	        this.proxyEvent('start', runner);
	        this.proxyEvent('suite', runner, root);
	        this.proxyEvent('test', runner, test);
	        if (error) {
	            this.proxyEvent('fail', runner, test, error);
	        }
	        else {
	            this.proxyEvent('pass', runner, test);
	        }
	        this.proxyEvent('test end', runner, test);
	        this.proxyEvent('suite end', runner, root);
	        this.proxyEvent('end', runner);
	    };
	    /**
	     * @param {!Location|string} location
	     * @return {string}
	     */
	    MultiReporter.prototype.suiteTitle = function (location) {
	        var path = util.relativeLocation(location, this.basePath);
	        path = util.cleanLocation(path);
	        return path;
	    };
	    // Internal Interface
	    /** @param {!Mocha.runners.Base} runner The runner to listen to events for. */
	    MultiReporter.prototype.bindChildRunner = function (runner) {
	        var _this = this;
	        MOCHA_EVENTS.forEach(function (eventName) {
	            runner.on(eventName, _this.proxyEvent.bind(_this, eventName, runner));
	        });
	    };
	    /**
	     * Evaluates an event fired by `runner`, proxying it forward or buffering it.
	     *
	     * @param {string} eventName
	     * @param {!Mocha.runners.Base} runner The runner that emitted this event.
	     * @param {...*} var_args Any additional data passed as part of the event.
	     */
	    MultiReporter.prototype.proxyEvent = function (eventName, runner) {
	        var _args = [];
	        for (var _i = 2; _i < arguments.length; _i++) {
	            _args[_i - 2] = arguments[_i];
	        }
	        var extraArgs = Array.prototype.slice.call(arguments, 2);
	        if (this.complete) {
	            console.warn('out of order Mocha event for ' + runner.name + ':', eventName, extraArgs);
	            return;
	        }
	        if (this.currentRunner && runner !== this.currentRunner) {
	            this.pendingEvents.push(Array.prototype.slice.call(arguments));
	            return;
	        }
	        util.debug('MultiReporter#proxyEvent(', arguments, ')');
	        // This appears to be a Mocha bug: Tests failed by passing an error to their
	        // done function don't set `err` properly.
	        //
	        // TODO(nevir): Track down.
	        if (eventName === 'fail' && !extraArgs[0].err) {
	            extraArgs[0].err = extraArgs[1];
	        }
	        if (eventName === 'start') {
	            this.onRunnerStart(runner);
	        }
	        else if (eventName === 'end') {
	            this.onRunnerEnd(runner);
	        }
	        else {
	            this.cleanEvent(eventName, runner, extraArgs);
	            this.emit.apply(this, [eventName].concat(extraArgs));
	        }
	    };
	    /**
	     * Cleans or modifies an event if needed.
	     *
	     * @param eventName
	     * @param runner The runner that emitted this event.
	     * @param extraArgs
	     */
	    MultiReporter.prototype.cleanEvent = function (eventName, _runner, extraArgs) {
	        // Suite hierarchy
	        if (extraArgs[0]) {
	            extraArgs[0] = this.showRootSuite(extraArgs[0]);
	        }
	        // Normalize errors
	        if (eventName === 'fail') {
	            extraArgs[1] = normalization.normalize(extraArgs[1], STACKY_CONFIG);
	        }
	        if (extraArgs[0] && extraArgs[0].err) {
	            extraArgs[0].err = normalization.normalize(extraArgs[0].err, STACKY_CONFIG);
	        }
	    };
	    /**
	     * We like to show the root suite's title, which requires a little bit of
	     * trickery in the suite hierarchy.
	     *
	     * @param {!Mocha.Runnable} node
	     */
	    MultiReporter.prototype.showRootSuite = function (node) {
	        var leaf = node = Object.create(node);
	        while (node && node.parent) {
	            var wrappedParent = Object.create(node.parent);
	            node.parent = wrappedParent;
	            node = wrappedParent;
	        }
	        node.root = false;
	        return leaf;
	    };
	    /** @param {!Mocha.runners.Base} runner */
	    MultiReporter.prototype.onRunnerStart = function (runner) {
	        util.debug('MultiReporter#onRunnerStart:', runner.name);
	        this.total = this.total - ESTIMATED_TESTS_PER_SUITE + runner.total;
	        this.currentRunner = runner;
	    };
	    /** @param {!Mocha.runners.Base} runner */
	    MultiReporter.prototype.onRunnerEnd = function (runner) {
	        util.debug('MultiReporter#onRunnerEnd:', runner.name);
	        this.currentRunner = null;
	        this.flushPendingEvents();
	    };
	    /**
	     * Flushes any buffered events and runs them through `proxyEvent`. This will
	     * loop until all buffered runners are complete, or we have run out of
	     * buffered events.
	     */
	    MultiReporter.prototype.flushPendingEvents = function () {
	        var _this = this;
	        var events = this.pendingEvents;
	        this.pendingEvents = [];
	        events.forEach(function (eventArgs) {
	            _this.proxyEvent.apply(_this, eventArgs);
	        });
	    };
	    return MultiReporter;
	}());
	exports.default = MultiReporter;

	});

	unwrapExports(multi);

	var title = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */

	var ARC_OFFSET = 0; // start at the right.
	var ARC_WIDTH = 6;
	/**
	 * A Mocha reporter that updates the document's title and favicon with
	 * at-a-glance stats.
	 *
	 * @param {!Mocha.Runner} runner The runner that is being reported on.
	 */
	var Title = /** @class */ (function () {
	    function Title(runner) {
	        Mocha.reporters.Base.call(this, runner);
	        runner.on('test end', this.report.bind(this));
	    }
	    /** Reports current stats via the page title and favicon. */
	    Title.prototype.report = function () {
	        this.updateTitle();
	        this.updateFavicon();
	    };
	    /** Updates the document title with a summary of current stats. */
	    Title.prototype.updateTitle = function () {
	        if (this.stats.failures > 0) {
	            document.title = util.pluralizedStat(this.stats.failures, 'failing');
	        }
	        else {
	            document.title = util.pluralizedStat(this.stats.passes, 'passing');
	        }
	    };
	    /** Updates the document's favicon w/ a summary of current stats. */
	    Title.prototype.updateFavicon = function () {
	        var canvas = document.createElement('canvas');
	        canvas.height = canvas.width = 32;
	        var context = canvas.getContext('2d');
	        var passing = this.stats.passes;
	        var pending = this.stats.pending;
	        var failing = this.stats.failures;
	        var total = Math.max(this.runner.total, passing + pending + failing);
	        drawFaviconArc(context, total, 0, passing, '#0e9c57');
	        drawFaviconArc(context, total, passing, pending, '#f3b300');
	        drawFaviconArc(context, total, pending + passing, failing, '#ff5621');
	        this.setFavicon(canvas.toDataURL());
	    };
	    /** Sets the current favicon by URL. */
	    Title.prototype.setFavicon = function (url) {
	        var current = document.head.querySelector('link[rel="icon"]');
	        if (current) {
	            document.head.removeChild(current);
	        }
	        var link = document.createElement('link');
	        link.rel = 'icon';
	        link.type = 'image/x-icon';
	        link.href = url;
	        link.setAttribute('sizes', '32x32');
	        document.head.appendChild(link);
	    };
	    return Title;
	}());
	exports.default = Title;
	/**
	 * Draws an arc for the favicon status, relative to the total number of tests.
	 */
	function drawFaviconArc(context, total, start, length, color) {
	    var arcStart = ARC_OFFSET + Math.PI * 2 * (start / total);
	    var arcEnd = ARC_OFFSET + Math.PI * 2 * ((start + length) / total);
	    context.beginPath();
	    context.strokeStyle = color;
	    context.lineWidth = ARC_WIDTH;
	    context.arc(16, 16, 16 - ARC_WIDTH / 2, arcStart, arcEnd);
	    context.stroke();
	}

	});

	unwrapExports(title);

	var suites = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */



	exports.htmlSuites = [];
	exports.jsSuites = [];
	// We process grep ourselves to avoid loading suites that will be filtered.
	var GREP = util.getParam('grep');
	// work around mocha bug (https://github.com/mochajs/mocha/issues/2070)
	if (GREP) {
	    GREP = GREP.replace(/\\\./g, '.');
	}
	/**
	 * Loads suites of tests, supporting both `.js` and `.html` files.
	 *
	 * @param files The files to load.
	 */
	function loadSuites(files) {
	    files.forEach(function (file) {
	        if (/\.js(\?.*)?$/.test(file)) {
	            exports.jsSuites.push(file);
	        }
	        else if (/\.html(\?.*)?$/.test(file)) {
	            exports.htmlSuites.push(file);
	        }
	        else {
	            throw new Error('Unknown resource type: ' + file);
	        }
	    });
	}
	exports.loadSuites = loadSuites;
	/**
	 * @return The child suites that should be loaded, ignoring
	 *     those that would not match `GREP`.
	 */
	function activeChildSuites() {
	    var subsuites = exports.htmlSuites;
	    if (GREP) {
	        var cleanSubsuites = [];
	        for (var i = 0, subsuite = void 0; subsuite = subsuites[i]; i++) {
	            if (GREP.indexOf(util.cleanLocation(subsuite)) !== -1) {
	                cleanSubsuites.push(subsuite);
	            }
	        }
	        subsuites = cleanSubsuites;
	    }
	    return subsuites;
	}
	exports.activeChildSuites = activeChildSuites;
	/**
	 * Loads all `.js` sources requested by the current suite.
	 */
	function loadJsSuites(_reporter, done) {
	    util.debug('loadJsSuites', exports.jsSuites);
	    var loaders = exports.jsSuites.map(function (file) {
	        // We only support `.js` dependencies for now.
	        return util.loadScript.bind(util, file);
	    });
	    util.parallel(loaders, done);
	}
	exports.loadJsSuites = loadJsSuites;
	function runSuites(reporter, childSuites, done) {
	    util.debug('runSuites');
	    var suiteRunners = [
	        // Run the local tests (if any) first, not stopping on error;
	        _runMocha.bind(null, reporter),
	    ];
	    // As well as any sub suites. Again, don't stop on error.
	    childSuites.forEach(function (file) {
	        suiteRunners.push(function (next) {
	            var childRunner = new childrunner.default(file, window);
	            reporter.emit('childRunner start', childRunner);
	            childRunner.run(function (error) {
	                reporter.emit('childRunner end', childRunner);
	                if (error)
	                    reporter.emitOutOfBandTest(file, error);
	                next();
	            });
	        });
	    });
	    util.parallel(suiteRunners, config.get('numConcurrentSuites'), function (error) {
	        reporter.done();
	        done(error);
	    });
	}
	exports.runSuites = runSuites;
	/**
	 * Kicks off a mocha run, waiting for frameworks to load if necessary.
	 *
	 * @param {!MultiReporter} reporter Where to send Mocha's events.
	 * @param {function} done A callback fired, _no error is passed_.
	 */
	function _runMocha(reporter, done, waited) {
	    if (config.get('waitForFrameworks') && !waited) {
	        var waitFor = (config.get('waitFor') || util.whenFrameworksReady).bind(window);
	        waitFor(_runMocha.bind(null, reporter, done, true));
	        return;
	    }
	    util.debug('_runMocha');
	    var mocha = window.mocha;
	    var Mocha = window.Mocha;
	    mocha.reporter(reporter.childReporter(window.location));
	    mocha.suite.title = reporter.suiteTitle(window.location);
	    mocha.grep(GREP);
	    // We can't use `mocha.run` because it bashes over grep, invert, and friends.
	    // See https://github.com/visionmedia/mocha/blob/master/support/tail.js#L137
	    var runner = Mocha.prototype.run.call(mocha, function (_error) {
	        if (document.getElementById('mocha')) {
	            Mocha.utils.highlightTags('code');
	        }
	        done(); // We ignore the Mocha failure count.
	    });
	    // Mocha's default `onerror` handling strips the stack (to support really old
	    // browsers). We upgrade this to get better stacks for async errors.
	    //
	    // TODO(nevir): Can we expand support to other browsers?
	    if (navigator.userAgent.match(/chrome/i)) {
	        window.onerror = null;
	        window.addEventListener('error', function (event) {
	            if (!event.error)
	                return;
	            if (event.error.ignore)
	                return;
	            if (window.uncaughtErrorFilter && window.uncaughtErrorFilter(event)) {
	                event.preventDefault();
	                return;
	            }
	            runner.uncaught(event.error);
	        });
	    }
	    else {
	        window.onerror = null;
	        window.addEventListener('error', function (event) {
	            if (window.uncaughtErrorFilter && window.uncaughtErrorFilter(event)) {
	                event.preventDefault();
	                return;
	            }
	            runner.uncaught(event.error);
	        });
	    }
	}

	});

	unwrapExports(suites);
	var suites_1 = suites.htmlSuites;
	var suites_2 = suites.jsSuites;
	var suites_3 = suites.loadSuites;
	var suites_4 = suites.activeChildSuites;
	var suites_5 = suites.loadJsSuites;
	var suites_6 = suites.runSuites;

	var reporters = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });





	exports.htmlSuites = [];
	exports.jsSuites = [];
	/**
	 * @param {CLISocket} socket The CLI socket, if present.
	 * @param {MultiReporter} parent The parent reporter, if present.
	 * @return {!Array.<!Mocha.reporters.Base} The reporters that should be used.
	 */
	function determineReporters(socket, parent) {
	    // Parents are greedy.
	    if (parent) {
	        return [parent.childReporter(window.location)];
	    }
	    // Otherwise, we get to run wild without any parental supervision!
	    var reporters = [title.default, console_1.default];
	    if (socket) {
	        reporters.push(function (runner) {
	            socket.observe(runner);
	        });
	    }
	    if (suites.htmlSuites.length > 0 || suites.jsSuites.length > 0) {
	        reporters.push(html.default);
	    }
	    return reporters;
	}
	exports.determineReporters = determineReporters;
	/**
	 * Yeah, hideous, but this allows us to be loaded before Mocha, which is handy.
	 */
	function injectMocha(Mocha) {
	    _injectPrototype(console_1.default, Mocha.reporters.Base.prototype);
	    _injectPrototype(html.default, Mocha.reporters.HTML.prototype);
	    // Mocha doesn't expose its `EventEmitter` shim directly, so:
	    _injectPrototype(multi.default, Object.getPrototypeOf(Mocha.Runner.prototype));
	}
	exports.injectMocha = injectMocha;
	function _injectPrototype(klass, prototype) {
	    var newPrototype = Object.create(prototype);
	    // Only support
	    Object.keys(klass.prototype).forEach(function (key) {
	        newPrototype[key] = klass.prototype[key];
	    });
	    // Since prototype is readonly on actual classes, we have to use
	    // defineProperty instead of `klass.prototype = newPrototype`;
	    // Object.defineProperty(
	    //    klass, 'prototype', {value: newPrototype, configurable: true});
	    klass.prototype = newPrototype;
	}

	});

	unwrapExports(reporters);
	var reporters_1 = reporters.htmlSuites;
	var reporters_2 = reporters.jsSuites;
	var reporters_3 = reporters.determineReporters;
	var reporters_4 = reporters.injectMocha;

	var environment = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */



	/**
	 * Loads all environment scripts ...synchronously ...after us.
	 */
	function loadSync() {
	    util.debug('Loading environment scripts:');
	    var a11ySuiteScriptPath = 'web-component-tester/data/a11ySuite.js';
	    var scripts = config.get('environmentScripts');
	    var a11ySuiteWillBeLoaded = window.__generatedByWct || scripts.indexOf(a11ySuiteScriptPath) > -1;
	    // We can't inject a11ySuite when running the npm version because it is a
	    // module-based script that needs `<script type=module>` and compilation
	    // for browsers without module support.
	    if (!a11ySuiteWillBeLoaded && !window.__wctUseNpm) {
	        // wct is running as a bower dependency, load a11ySuite from data/
	        scripts.push(a11ySuiteScriptPath);
	    }
	    scripts.forEach(function (path) {
	        var url = util.expandUrl(path, config.get('root'));
	        util.debug('Loading environment script:', url);
	        // Synchronous load.
	        document.write("<script src=\"" + encodeURI(url) + "\"></script>");
	    });
	    util.debug('Environment scripts loaded');
	    var imports = config.get('environmentImports');
	    imports.forEach(function (path) {
	        var url = util.expandUrl(path, config.get('root'));
	        util.debug('Loading environment import:', url);
	        // Synchronous load.
	        document.write("<link rel=\"import\" href=\"" + encodeURI(url) + "\">");
	    });
	    util.debug('Environment imports loaded');
	}
	exports.loadSync = loadSync;
	/**
	 * We have some hard dependencies on things that should be loaded via
	 * `environmentScripts`, so we assert that they're present here; and do any
	 * post-facto setup.
	 */
	function ensureDependenciesPresent() {
	    _ensureMocha();
	    _checkChai();
	}
	exports.ensureDependenciesPresent = ensureDependenciesPresent;
	function _ensureMocha() {
	    var Mocha = window.Mocha;
	    if (!Mocha) {
	        throw new Error('WCT requires Mocha. Please ensure that it is present in WCT.environmentScripts, or that you load it before loading web-component-tester/browser.js');
	    }
	    reporters.injectMocha(Mocha);
	    // Magic loading of mocha's stylesheet
	    var mochaPrefix = util.scriptPrefix('mocha.js');
	    // only load mocha stylesheet for the test runner output
	    // Not the end of the world, if it doesn't load.
	    if (mochaPrefix && window.top === window.self) {
	        util.loadStyle(mochaPrefix + 'mocha.css');
	    }
	}
	function _checkChai() {
	    if (!window.chai) {
	        util.debug('Chai not present; not registering shorthands');
	        return;
	    }
	    window.assert = window.chai.assert;
	    window.expect = window.chai.expect;
	}

	});

	unwrapExports(environment);
	var environment_1 = environment.loadSync;
	var environment_2 = environment.ensureDependenciesPresent;

	var errors = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */

	// We may encounter errors during initialization (for example, syntax errors in
	// a test file). Hang onto those (and more) until we are ready to report them.
	exports.globalErrors = [];
	/**
	 * Hook the environment to pick up on global errors.
	 */
	function listenForErrors() {
	    window.addEventListener('error', function (event) {
	        exports.globalErrors.push(event.error);
	    });
	    // Also, we treat `console.error` as a test failure. Unless you prefer not.
	    var origConsole = console;
	    var origError = console.error;
	    console.error = function wctShimmedError() {
	        origError.apply(origConsole, arguments);
	        if (config.get('trackConsoleError')) {
	            throw 'console.error: ' + Array.prototype.join.call(arguments, ' ');
	        }
	    };
	}
	exports.listenForErrors = listenForErrors;

	});

	unwrapExports(errors);
	var errors_1 = errors.globalErrors;
	var errors_2 = errors.listenForErrors;

	var extend = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	var interfaceExtensions = [];
	/**
	 * Registers an extension that extends the global `Mocha` implementation
	 * with new helper methods. These helper methods will be added to the `window`
	 * when tests run for both BDD and TDD interfaces.
	 */
	function extendInterfaces(helperName, helperFactory) {
	    interfaceExtensions.push(function () {
	        var Mocha = window.Mocha;
	        // For all Mocha interfaces (probably just TDD and BDD):
	        Object.keys(Mocha.interfaces)
	            .forEach(function (interfaceName) {
	            // This is the original callback that defines the interface (TDD or
	            // BDD):
	            var originalInterface = Mocha.interfaces[interfaceName];
	            // This is the name of the "teardown" or "afterEach" property for the
	            // current interface:
	            var teardownProperty = interfaceName === 'tdd' ? 'teardown' : 'afterEach';
	            // The original callback is monkey patched with a new one that appends
	            // to the global context however we want it to:
	            Mocha.interfaces[interfaceName] = function (suite) {
	                // Call back to the original callback so that we get the base
	                // interface:
	                originalInterface.apply(this, arguments);
	                // Register a listener so that we can further extend the base
	                // interface:
	                suite.on('pre-require', function (context, _file, _mocha) {
	                    // Capture a bound reference to the teardown function as a
	                    // convenience:
	                    var teardown = context[teardownProperty].bind(context);
	                    // Add our new helper to the testing context. The helper is
	                    // generated by a factory method that receives the context,
	                    // the teardown function and the interface name and returns
	                    // the new method to be added to that context:
	                    context[helperName] =
	                        helperFactory(context, teardown, interfaceName);
	                });
	            };
	        });
	    });
	}
	exports.extendInterfaces = extendInterfaces;
	/**
	 * Applies any registered interface extensions. The extensions will be applied
	 * as many times as this function is called, so don't call it more than once.
	 */
	function applyExtensions() {
	    interfaceExtensions.forEach(function (applyExtension) {
	        applyExtension();
	    });
	}
	exports.applyExtensions = applyExtensions;

	});

	unwrapExports(extend);
	var extend_1 = extend.extendInterfaces;
	var extend_2 = extend.applyExtensions;

	var fixture = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	extend.extendInterfaces('fixture', function (context, teardown) {
	    // Return context.fixture if it is already a thing, for backwards
	    // compatibility with `test-fixture-mocha.js`:
	    return context.fixture || function fixture(fixtureId, model) {
	        // Automatically register a teardown callback that will restore the
	        // test-fixture:
	        teardown(function () {
	            document.getElementById(fixtureId).restore();
	        });
	        // Find the test-fixture with the provided ID and create it, returning
	        // the results:
	        return document.getElementById(fixtureId).create(model);
	    };
	});

	});

	unwrapExports(fixture);

	var stub = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	/**
	 * stub
	 *
	 * The stub addon allows the tester to partially replace the implementation of
	 * an element with some custom implementation. Usage example:
	 *
	 * beforeEach(function() {
	 *   stub('x-foo', {
	 *     attached: function() {
	 *       // Custom implementation of the `attached` method of element `x-foo`..
	 *     },
	 *     otherMethod: function() {
	 *       // More custom implementation..
	 *     },
	 *     getterSetterProperty: {
	 *       get: function() {
	 *         // Custom getter implementation..
	 *       },
	 *       set: function() {
	 *         // Custom setter implementation..
	 *       }
	 *     },
	 *     // etc..
	 *   });
	 * });
	 */
	extend.extendInterfaces('stub', function (_context, teardown) {
	    return function stub(tagName, implementation) {
	        // Find the prototype of the element being stubbed:
	        var proto = document.createElement(tagName).constructor.prototype;
	        // For all keys in the implementation to stub with..
	        var stubs = Object.keys(implementation).map(function (key) {
	            // Stub the method on the element prototype with Sinon:
	            return sinon.stub(proto, key, implementation[key]);
	        });
	        // After all tests..
	        teardown(function () {
	            stubs.forEach(function (stub) {
	                stub.restore();
	            });
	        });
	    };
	});

	});

	unwrapExports(stub);

	var replace = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	// replacement map stores what should be
	var replacements = {};
	var replaceTeardownAttached = false;
	/**
	 * replace
	 *
	 * The replace addon allows the tester to replace all usages of one element with
	 * another element within all Polymer elements created within the time span of
	 * the test. Usage example:
	 *
	 * beforeEach(function() {
	 *   replace('x-foo').with('x-fake-foo');
	 * });
	 *
	 * All annotations and attributes will be set on the placement element the way
	 * they were set for the original element.
	 */
	extend.extendInterfaces('replace', function (_context, teardown) {
	    return function replace(oldTagName) {
	        return {
	            with: function (tagName) {
	                // Standardizes our replacements map
	                oldTagName = oldTagName.toLowerCase();
	                tagName = tagName.toLowerCase();
	                replacements[oldTagName] = tagName;
	                // If the function is already a stub, restore it to original
	                if (document.importNode.isSinonProxy) {
	                    return;
	                }
	                if (!window.Polymer.Element) {
	                    window.Polymer.Element = function () { };
	                    window.Polymer.Element.prototype._stampTemplate = function () { };
	                }
	                // Keep a reference to the original `document.importNode`
	                // implementation for later:
	                var originalImportNode = document.importNode;
	                // Use Sinon to stub `document.ImportNode`:
	                sinon
	                    .stub(document, 'importNode', function (origContent, deep) {
	                    var templateClone = document.createElement('template');
	                    var content = templateClone.content;
	                    var inertDoc = content.ownerDocument;
	                    // imports node from inertDoc which holds inert nodes.
	                    templateClone.content.appendChild(inertDoc.importNode(origContent, true));
	                    // optional arguments are not optional on IE.
	                    var nodeIterator = document.createNodeIterator(content, NodeFilter.SHOW_ELEMENT, null, true);
	                    var node;
	                    // Traverses the tree. A recently-replaced node will be put
	                    // next, so if a node is replaced, it will be checked if it
	                    // needs to be replaced again.
	                    while (node = nodeIterator.nextNode()) {
	                        var currentTagName = node.tagName.toLowerCase();
	                        if (replacements.hasOwnProperty(currentTagName)) {
	                            currentTagName = replacements[currentTagName];
	                            // find the final tag name.
	                            while (replacements[currentTagName]) {
	                                currentTagName = replacements[currentTagName];
	                            }
	                            // Create a replacement:
	                            var replacement = document.createElement(currentTagName);
	                            // For all attributes in the original node..
	                            for (var index = 0; index < node.attributes.length; ++index) {
	                                // Set that attribute on the replacement:
	                                replacement.setAttribute(node.attributes[index].name, node.attributes[index].value);
	                            }
	                            // Replace the original node with the replacement node:
	                            node.parentNode.replaceChild(replacement, node);
	                        }
	                    }
	                    return originalImportNode.call(this, content, deep);
	                });
	                if (!replaceTeardownAttached) {
	                    // After each test...
	                    teardown(function () {
	                        replaceTeardownAttached = true;
	                        // Restore the stubbed version of `document.importNode`:
	                        var documentImportNode = document.importNode;
	                        if (documentImportNode.isSinonProxy) {
	                            documentImportNode.restore();
	                        }
	                        // Empty the replacement map
	                        replacements = {};
	                    });
	                }
	            }
	        };
	    };
	});

	});

	unwrapExports(replace);

	var mocha_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */





	// Mocha global helpers, broken out by testing method.
	//
	// Keys are the method for a particular interface; values are their analog in
	// the opposite interface.
	var MOCHA_EXPORTS = {
	    // https://github.com/visionmedia/mocha/blob/master/lib/interfaces/tdd.js
	    tdd: {
	        'setup': '"before"',
	        'teardown': '"after"',
	        'suiteSetup': '"beforeEach"',
	        'suiteTeardown': '"afterEach"',
	        'suite': '"describe" or "context"',
	        'test': '"it" or "specify"',
	    },
	    // https://github.com/visionmedia/mocha/blob/master/lib/interfaces/bdd.js
	    bdd: {
	        'before': '"setup"',
	        'after': '"teardown"',
	        'beforeEach': '"suiteSetup"',
	        'afterEach': '"suiteTeardown"',
	        'describe': '"suite"',
	        'context': '"suite"',
	        'xdescribe': '"suite.skip"',
	        'xcontext': '"suite.skip"',
	        'it': '"test"',
	        'xit': '"test.skip"',
	        'specify': '"test"',
	        'xspecify': '"test.skip"',
	    },
	};
	/**
	 * Exposes all Mocha methods up front, configuring and running mocha
	 * automatically when you call them.
	 *
	 * The assumption is that it is a one-off (sub-)suite of tests being run.
	 */
	function stubInterfaces() {
	    var keys = Object.keys(MOCHA_EXPORTS);
	    keys.forEach(function (ui) {
	        Object.keys(MOCHA_EXPORTS[ui]).forEach(function (key) {
	            window[key] = function wrappedMochaFunction() {
	                _setupMocha(ui, key, MOCHA_EXPORTS[ui][key]);
	                if (!window[key] || window[key] === wrappedMochaFunction) {
	                    throw new Error('Expected mocha.setup to define ' + key);
	                }
	                window[key].apply(window, arguments);
	            };
	        });
	    });
	}
	exports.stubInterfaces = stubInterfaces;
	/**
	 * @param {string} ui Sets up mocha to run `ui`-style tests.
	 * @param {string} key The method called that triggered this.
	 * @param {string} alternate The matching method in the opposite interface.
	 */
	function _setupMocha(ui, key, alternate) {
	    var mochaOptions = config.get('mochaOptions');
	    if (mochaOptions.ui && mochaOptions.ui !== ui) {
	        var message = 'Mixing ' + mochaOptions.ui + ' and ' + ui +
	            ' Mocha styles is not supported. ' +
	            'You called "' + key + '". Did you mean ' + alternate + '?';
	        throw new Error(message);
	    }
	    extend.applyExtensions();
	    mochaOptions.ui = ui;
	    mocha.setup(mochaOptions); // Note that the reporter is configured in run.js.
	}

	});

	unwrapExports(mocha_1);
	var mocha_2 = mocha_1.stubInterfaces;

	var lib = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * @license
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
	 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
	 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
	 * Google as part of the polymer project is also subject to an additional IP
	 * rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * This file is the entry point into `web-component-tester`'s browser client.
	 */
	// Registers a bunch of globals:











	function initialize(initConfig) {
	    // You can configure WCT before it has loaded by assigning your custom
	    // configuration to the global `WCT`.
	    if (initConfig && window.WCT) {
	        config.deepMerge(initConfig, window.WCT);
	    }
	    config.setup(initConfig);
	    // Maybe some day we'll expose WCT as a module to whatever module registry you
	    // are using (aka the UMD approach), or as an es6 module.
	    var WCT = window.WCT = {
	        // A generic place to hang data about the current suite. This object is
	        // reported
	        // back via the `sub-suite-start` and `sub-suite-end` events.
	        share: {},
	        // Until then, we get to rely on it to expose parent runners to their
	        // children.
	        _ChildRunner: childrunner.default,
	        _reporter: undefined,
	        _config: config._config,
	        // Public API
	        /**
	         * Loads suites of tests, supporting both `.js` and `.html` files.
	         *
	         * @param {!Array.<string>} files The files to load.
	         */
	        loadSuites: suites.loadSuites,
	    };
	    // Load Process
	    errors.listenForErrors();
	    mocha_1.stubInterfaces();
	    environment.loadSync();
	    // Give any scripts on the page a chance to declare tests and muck with
	    // things.
	    document.addEventListener('DOMContentLoaded', function () {
	        util.debug('DOMContentLoaded');
	        environment.ensureDependenciesPresent();
	        // We need the socket built prior to building its reporter.
	        clisocket.default.init(function (error, socket) {
	            if (error)
	                throw error;
	            // Are we a child of another run?
	            var current = childrunner.default.current();
	            var parent = current && current.parentScope.WCT._reporter;
	            util.debug('parentReporter:', parent);
	            var childSuites = suites.activeChildSuites();
	            var reportersToUse = reporters.determineReporters(socket, parent);
	            // +1 for any local tests.
	            var reporter = new multi.default(childSuites.length + 1, reportersToUse, parent);
	            WCT._reporter = reporter; // For environment/compatibility.js
	            // We need the reporter so that we can report errors during load.
	            suites.loadJsSuites(reporter, function (error) {
	                // Let our parent know that we're about to start the tests.
	                if (current)
	                    current.ready(error);
	                if (error)
	                    throw error;
	                // Emit any errors we've encountered up til now
	                errors.globalErrors.forEach(function onError(error) {
	                    reporter.emitOutOfBandTest('Test Suite Initialization', error);
	                });
	                suites.runSuites(reporter, childSuites, function (error) {
	                    // Make sure to let our parent know that we're done.
	                    if (current)
	                        current.done();
	                    if (error)
	                        throw error;
	                });
	            });
	        });
	    });
	}
	exports.initialize = initialize;

	});

	unwrapExports(lib);
	var lib_1 = lib.initialize;

	var browser = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	lib.initialize();

	});

	var browser$1 = unwrapExports(browser);

	return browser$1;

}());
