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
import * as ChaiStatic from 'chai';
import * as SinonStatic from 'sinon';
import * as SocketIOStatic from 'socket.io';

import {default as ChildRunner, SharedState} from './childrunner.js';
import {Config} from './config.js';
import MultiReporter from './reporters/multi.js';
import * as suites from './suites.js';

type loadSuitesType = (typeof suites.loadSuites);

declare global {
  interface Window {
    __wctUseNpm?: boolean;
    WebComponents?: WebComponentsStatic;
    Platform?: PlatformStatic;
    Polymer?: PolymerStatic;
    WCT: {
      readonly _ChildRunner: typeof ChildRunner; //
      readonly share: SharedState; //
      readonly _config: Config; //
      readonly loadSuites: loadSuitesType;
      _reporter: MultiReporter;
    };
    mocha: typeof mocha;
    Mocha: typeof Mocha;
    __generatedByWct?: boolean;

    chai: typeof ChaiStatic;
    assert: typeof ChaiStatic.assert;
    expect: typeof ChaiStatic.expect;
  }
  interface WebComponentsStatic {
    ready?(): void;
    flush?(): void;
  }
  interface PlatformStatic {
    performMicrotaskCheckpoint(): void;
  }
  interface PolymerElement {
    _stampTemplate?(): void;
  }
  interface PolymerElementConstructor {
    prototype: PolymerElement;
  }
  interface PolymerStatic {
    flush(): void;
    dom: {flush(): void};
    Element: PolymerElementConstructor;
  }

  interface Element {
    isConnected: boolean;
  }

  interface Mocha {
    suite: Mocha.Suite;
  }

  var io: typeof SocketIOStatic;
  var Platform: PlatformStatic;
  var sinon: typeof SinonStatic;
}
