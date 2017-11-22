/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {WarningCarryingException} from 'polymer-analyzer';
import {Disposable, IConnection} from 'vscode-languageserver';

export class EventStream<T> {
  static create<T>() {
    const stream = new EventStream<T>();
    const fire: typeof stream.fire = stream.fire.bind(stream);
    return {fire, stream};
  }

  private handlers = new Set<(value: T) => void>();
  private fire(value: T) {
    for (const handler of this.handlers) {
      handler(value);
    }
  }

  listen(handler: (value: T) => void) {
    this.handlers.add(handler);
    return {
      dispose: () => {
        this.handlers.delete(handler);
      }
    };
  }

  /**
   * Return a fresh Promise that resolves with the next value.
   *
   * Mostly useful in tests.
   */
  get next(): Promise<T> {
    return new Promise((resolve) => {
      const disposable = this.listen((value) => {
        disposable.dispose();
        resolve(value);
      });
    });
  }
}

export class AutoDisposable implements Disposable {
  dispose(): void {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }

  protected readonly _disposables: Disposable[] = [];
}

export abstract class Handler extends AutoDisposable {
  protected abstract connection: IConnection;
  protected async handleErrors<Result, Fallback>(
      promise: Promise<Result>,
      fallbackValue: Fallback): Promise<Result|Fallback> {
    try {
      return await promise;
    } catch (err) {
      // Ignore WarningCarryingExceptions, they're expected, and made visible
      //   to the user in a useful way. All other exceptions should be logged
      //   if possible.
      if (!(err instanceof WarningCarryingException)) {
        this.connection.console.warn(err.stack || err.message || err);
      }
      return fallbackValue;
    }
  }
}

export interface Change<T> {
  newer: T;
  older: T;
}
