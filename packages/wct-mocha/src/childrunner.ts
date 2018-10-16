/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */
import * as util from './util.js';

// TODO(thedeeno): Consider renaming subsuite. IIRC, childRunner is entirely
// distinct from mocha suite, which tripped me up badly when trying to add
// plugin support. Perhaps something like 'batch', or 'bundle'. Something that
// has no mocha correlate. This may also eliminate the need for root/non-root
// suite distinctions.

interface EventListenerDescriptor {
  listener: EventListenerOrEventListenerObject;
  target: EventTarget;
  type: string;
}

export interface SharedState {}

/**
 * A Mocha suite (or suites) run within a child iframe, but reported as if they
 * are part of the current context.
 */
export default class ChildRunner {
  private container?: HTMLDivElement;
  private eventListenersToRemoveOnClean: EventListenerDescriptor[] = [];
  private iframe?: HTMLIFrameElement;
  private onRunComplete: (error?: {}) => void;
  private share: SharedState;
  private state: 'initializing'|'loading'|'complete';
  private timeoutId?: number;
  private url: string;

  public parentScope: Window;

  constructor(url: string, parentScope: Window) {
    this.parentScope = parentScope;

    const urlBits = util.parseUrl(url);
    util.mergeParams(
        urlBits.params, util.getParams(parentScope.location.search));
    delete urlBits.params.cli_browser_id;

    this.url = `${urlBits.base}${util.paramsToQuery(urlBits.params)}`;
    this.state = 'initializing';
  }

  /**
   * Listeners added using this method will be removed on done()
   *
   * @param type event type
   * @param listener object which receives a notification
   * @param target event target
   */
  private addEventListener(
      type: string, listener: EventListenerOrEventListenerObject,
      target: EventTarget): void {
    target.addEventListener(type, listener);
    const descriptor: EventListenerDescriptor = {target, type, listener};
    this.eventListenersToRemoveOnClean.push(descriptor);
  }

  /**
   * Removes all event listeners added by a method addEventListener defined
   * on an instance of ChildRunner.
   */
  private removeAllEventListeners(): void {
    this.eventListenersToRemoveOnClean.forEach(
        ({target, type, listener}) =>
            target.removeEventListener(type, listener));
  }

  // ChildRunners get a pretty generous load timeout by default.
  static loadTimeout = 60000;

  // We can't maintain properties on iframe elements in Firefox/Safari/???, so
  // we track childRunners by URL.
  private static byUrl: {[url: string]: undefined|ChildRunner} = {};

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
            'Subsuite loaded but was never registered. This most likely is due to wonky history behavior. Reloading...');
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
  run(done: (error?: {}) => void) {
    util.debug('ChildRunner#run', this.url);

    this.state = 'loading';
    this.onRunComplete = done;

    this.container = document.getElementById('subsuites') as HTMLDivElement;
    if (!this.container) {
      const container = (this.container = document.createElement('div'));
      container.id = 'subsuites';
      document.body.appendChild(container as Node);
    }

    const {container} = this;

    const iframe = (this.iframe = document.createElement('iframe'));
    iframe.classList.add('subsuite');
    iframe.src = this.url;
    // Let the iframe expand the URL for us.
    const url = (this.url = iframe.src);

    container.appendChild(iframe as Node);

    ChildRunner.byUrl[url] = this;

    this.timeoutId = window.setTimeout(
        () => this.loaded(new Error('Timed out loading ' + url)),
        ChildRunner.loadTimeout);

    this.addEventListener(
        'error',
        () => this.loaded(new Error('Failed to load document ' + this.url)),
        iframe);
    this.addEventListener(
        'DOMContentLoaded', () => this.loaded(), iframe.contentWindow);
  }

  /**
   * Called when the sub suite's iframe has loaded (or errored during load).
   *
   * @param {*} error The error that occured, if any.
   */
  loaded(error?: {}) {
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
  ready(error?: {}) {
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
        this.removeAllEventListeners();

        this.container.removeChild(this.iframe as Node);
        this.iframe = undefined;
        this.share = null;
      }, 0);
    }
  }

  signalRunComplete(error?: {}) {
    if (this.onRunComplete) {
      this.state = 'complete';
      this.onRunComplete(error);
      this.onRunComplete = null;
    }
  }
}
