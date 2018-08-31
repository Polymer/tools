import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: './browser/index.js',
  output: {file: 'browser.js', format: 'iife'},
  name: 'WctBrowser',
  plugins: [resolve(), commonjs()]
};
