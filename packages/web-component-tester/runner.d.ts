import * as _cli from './runner/cli';
import * as _config from './runner/config';
import * as _gulp from './runner/gulp';
import * as _steps from './runner/steps';
import * as _test from './runner/test';

export {Browser, Config} from './runner/config'

export const cli = {
  run: _cli.run,
  runSauceTunnel: _cli.runSauceTunnel
};

export const config = {
  getPackageName: _config.getPackageName,
  defaults: _config.defaults,
  PreparsedArgs: _config.PreparsedArgs,
  fromDisk: _config.fromDisk,
  preparseArgs: _config.preparseArgs,
  parseArgs: _config.parseArgs,
  merge: _config.merge,
  normalize: _config.normalize,
  expand: _config.expand,
  validate: _config.validate
};

export const gulp = {
  init: _gulp.init
};

export const steps = {
  setupOverrides: _steps.setupOverrides,
  loadPlugins: _steps.loadPlugins,
  configure: _steps.configure,
  prepare: _steps.prepare,
  runTests: _steps.runTests,
  cancelTests: _steps.cancelTests
};

export const test = {
  test: _test.test
};
