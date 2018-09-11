import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: './browser/index.js',
  output: {name: 'WctBrowser', file: 'browser.js', format: 'iife'},
  plugins: [resolve(), commonjs()]
};
