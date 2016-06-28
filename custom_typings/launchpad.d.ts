declare module 'launchpad' {
  import * as events from 'events';
  export function local(cb: (err: any, localBrowsers: Launcher) => void): void;
  export namespace local {
    export const platform: {
      chrome?: BrowserPlatformDetails;
      chromium?: BrowserPlatformDetails;
      canary?: BrowserPlatformDetails;
      firefox?: BrowserPlatformDetails;
      aurora?: BrowserPlatformDetails;
      opera?: BrowserPlatformDetails;
      ie?: BrowserPlatformDetails;
      edge?: BrowserPlatformDetails;
      safari?: BrowserPlatformDetails;
      phantom?: BrowserPlatformDetails;
      nodeWebkit?: BrowserPlatformDetails;
    };
  }
  interface BrowserPlatformDetails {
    pathQuery?: string;
    plistPath?: string;
    command?: string;
    process?: string;
    versionKey?: string;
    defaultLocation?: string;
    args?: string[];
    opensTab?: boolean;
    multi?: boolean;
    getCommand?: (browser: BrowserPlatformDetails, url: string, args: string[]) => string;
    cwd?: string;
    imageName?: string;
  }
  interface Launcher {
    browsers(cb: (error: any, browsers?: Browser[]) => void): void;

    chrome: BrowserFunction;
    chromium: BrowserFunction;
    canary: BrowserFunction;
    firefox: BrowserFunction;
    aurora: BrowserFunction;
    opera: BrowserFunction;
    ie: BrowserFunction;
    edge: BrowserFunction;
    safari: BrowserFunction;
    phantom: BrowserFunction;
    nodeWebkit: BrowserFunction;
  }
  interface Browser {
    name: string;
    version: string;
    binPath: string;
  }
  interface BrowserFunction {
    (url: string, callback: (err: any, instance: Instance) => void): void;
  }
  interface Instance extends events.EventEmitter {

  }
}
