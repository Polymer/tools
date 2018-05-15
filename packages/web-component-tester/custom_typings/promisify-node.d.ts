declare module 'promisify-node' {
  interface NodeCallback<T, U> {
    (err: U, value: T): void;
  }
  function promisify<T, U>(f: (cb: NodeCallback<T, U>) => void): () =>
      Promise<T>;
  function promisify<A1, T, U>(f: (a: A1, cb: NodeCallback<T, U>) => void):
      (a: A1) => Promise<T>;
  function promisify<A1, A2, T, U>(
      f: (a: A1, a2: A2, cb: NodeCallback<T, U>) => void): (a: A1, a2: A2) =>
      Promise<T>;
  function promisify<A1, A2, A3, T, U>(
      f: (a: A1, a2: A2, a3: A3, cb: NodeCallback<T, U>) =>
          void): (a: A1, a2: A2, a3: A3) => Promise<T>;
  namespace promisify {}
  export = promisify;
}
