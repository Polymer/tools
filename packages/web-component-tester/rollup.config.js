// rollup.config.js
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  input: './browser/index.js',
  output: {file: 'browser.js', format: 'iife'},
  plugins: [nodeResolve()]
};