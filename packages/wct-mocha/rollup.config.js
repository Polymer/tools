import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'lib/browser.js',
  output: {name: 'WctMocha', file: 'browser.js', format: 'iife'},
  plugins: [resolve(), commonjs()]
};
