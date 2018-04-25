declare module 'stable' {
  export default {
    inplace<T>(collection: T[], comparator: (a: T, b: T) => -1 | 0 | 1): void;
  };
}
