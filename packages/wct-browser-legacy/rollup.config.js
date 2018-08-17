// rollup.config.js
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  input: './lib/browser.js',
  output: {file: 'browser.js', format: 'iife'},
  plugins: [nodeResolve()]
};