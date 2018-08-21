import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'lib/browser.js',
  output: {
    file: 'browser.js',
    format: 'iife'
  },
  name: 'WctMocha',
  plugins: [
    resolve(),
    commonjs()
  ]
};
