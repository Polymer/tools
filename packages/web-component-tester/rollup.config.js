import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: './browser/index.js',
  output: {
    file: 'browser.js',
    format: 'iife'
  },
  name: 'WctBrowser',
  plugins: [
    resolve(),
    commonjs()
  ]
};
