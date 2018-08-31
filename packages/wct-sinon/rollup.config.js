import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'lib/browser.js',
  output: {file: 'browser.js', format: 'iife'},
  name: 'WctSinon',
  plugins: [resolve(), commonjs()]
};
