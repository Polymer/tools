import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'lib/browser.js',
  output: {name: 'WctMocha', file: 'wct-mocha.js', format: 'iife'},
  plugins: [resolve(), commonjs()]
};
