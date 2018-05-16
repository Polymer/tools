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
import * as util from './util.js';

const DOM_CONTENT_LOADED_EVENT_NAME = 'DOMContentLoaded';
const IFRAME_ERROR_EVENT_NAME = 'error';

// TODO(thedeeno): Consider renaming subsuite. IIRC, childRunner is entirely
// distinct from mocha suite, which tripped me up badly when trying to add
// plugin support. Perhaps something like 'batch', or 'bundle'. Something that
// has no mocha correlate. This may also eliminate the need for root/non-root
// suite distinctions.

export interface SharedState {}

/**
 * A Mocha suite (or suites) run within a child iframe, but reported as if they
 * are part of the current context.
 */
export default class ChildRunner {
  public parentScope: Window;

  private container?: HTMLDivElement;
  private domContentLoadedCallback: (e: Event) => void;
  private iframe?: HTMLIFrameElement;
  private iframeErrorCallback: (e: Event) => void;
  private onRunComplete: (error?: any) => void;
  private share: SharedState;
  private state: 'initializing' | 'loading' | 'complete';
  private timeoutId?: number;
  private url: string;

  constructor(url: string, parentScope: Window) {
    this.parentScope = parentScope;

    const urlBits = util.parseUrl(url);
    util.mergeParams(
      urlBits.params,
      util.getParams(parentScope.location.search)
    );
    delete urlBits.params.cli_browser_id;

    const urlWithMergedParams = (this.url =
      urlBits.base + util.paramsToQuery(urlBits.params));

    this.initializeCallbacks(urlWithMergedParams);
    this.state = 'initializing';
  }

  private initializeCallbacks(url: string) {
    this.iframeErrorCallback = () =>
      this.loaded(new Error('Failed to load document ' + url));
    this.domContentLoadedCallback = () => this.loaded();
  }

  // ChildRunners get a pretty generous load timeout by default.
  static loadTimeout = 60000;

  // We can't maintain properties on iframe elements in Firefox/Safari/???, so
  // we track childRunners by URL.
  private static byUrl: { [url: string]: undefined | ChildRunner } = {};

  /**
   * @return {ChildRunner} The `ChildRunner` that was registered for this
   * window.
   */
  static current(): ChildRunner {
    return ChildRunner.get(window);
  }

  /**
   * @param {!Window} target A window to find the ChildRunner of.
   * @param {boolean} traversal Whether this is a traversal from a child window.
   * @return {ChildRunner} The `ChildRunner` that was registered for `target`.
   */
  static get(target: Window, traversal?: boolean): ChildRunner {
    const childRunner = ChildRunner.byUrl[target.location.href];
    if (childRunner) {
      return childRunner;
    }
    if (window.parent === window) {
      // Top window.
      if (traversal) {
        console.warn(
          'Subsuite loaded but was never registered. This most likely is due to wonky history behavior. Reloading...'
        );
        window.location.reload();
      }
      return null;
    }
    // Otherwise, traverse.
    return window.parent.WCT._ChildRunner.get(target, true);
  }

  /**
   * Loads and runs the subsuite.
   *
   * @param {function} done Node-style callback.
   */
  run(done: (error?: any) => void) {
    util.debug('ChildRunner#run', this.url);

    this.state = 'loading';
    this.onRunComplete = done;

    this.container = document.getElementById('subsuites') as HTMLDivElement;
    if (!this.container) {
      const container = (this.container = document.createElement('div'));
      container.id = 'subsuites';
      document.body.appendChild(container as Node);
    }

    const { container } = this;

    const iframe = (this.iframe = document.createElement('iframe'));
    this.iframe.classList.add('subsuite');
    this.iframe.src = this.url;
    // Let the iframe expand the URL for us.
    const url = (this.url = this.iframe.src);

    container.appendChild(iframe as Node);

    ChildRunner.byUrl[url] = this;

    this.timeoutId = setTimeout(
      this.loaded.bind(this, new Error('Timed out loading ' + this.url)),
      ChildRunner.loadTimeout
    );

    this.iframe.addEventListener(
      IFRAME_ERROR_EVENT_NAME,
      this.iframeErrorCallback
    );

    this.iframe.contentWindow.addEventListener(
      DOM_CONTENT_LOADED_EVENT_NAME,
      this.domContentLoadedCallback
    );
  }

  /**
   * Called when the sub suite's iframe has loaded (or errored during load).
   *
   * @param {*} error The error that occured, if any.
   */
  loaded(error?: any) {
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
  }

  /**
   * Called in mocha/run.js when all dependencies have loaded, and the child is
   * ready to start running tests
   *
   * @param {*} error The error that occured, if any.
   */
  ready(error?: any) {
    util.debug('ChildRunner#ready', this.url, error);
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    if (error) {
      this.signalRunComplete(error);
      this.done();
    }
  }

  /**
   * Called when the sub suite's tests are complete, so that it can clean up.
   */
  done() {
    util.debug('ChildRunner#done', this.url, arguments);

    // Make sure to clear that timeout.
    this.ready();
    this.signalRunComplete();

    if (this.iframe) {
      // Be safe and avoid potential browser crashes when logic attempts to
      // interact with the removed iframe.
      setTimeout(() => {
        const { iframe } = this;
        iframe.removeEventListener(
          IFRAME_ERROR_EVENT_NAME,
          this.iframeErrorCallback
        );
        iframe.contentWindow.removeEventListener(
          DOM_CONTENT_LOADED_EVENT_NAME,
          this.domContentLoadedCallback
        );
        this.container.removeChild(iframe as Node);
        this.iframe = undefined;
      }, 0);
    }
  }

  signalRunComplete(error?: any) {
    if (this.onRunComplete) {
      this.state = 'complete';
      this.onRunComplete(error);
      this.onRunComplete = null;
    }
  }
}
