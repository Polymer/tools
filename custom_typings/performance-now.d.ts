// Delete this once https://github.com/braveg1rl/performance-now/pull/8 lands.

declare module 'performance-now' {
  function now(): number;
  namespace now {}
  export = now;
}
