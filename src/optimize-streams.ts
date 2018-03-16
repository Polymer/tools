/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as cssSlam from 'css-slam';
import * as gulpif from 'gulp-if';
import {minify as htmlMinify, Options as HTMLMinifierOptions} from 'html-minifier';
import * as logging from 'plylog';
import {ModuleResolutionStrategy} from 'polymer-project-config';
import {Transform} from 'stream';
import * as vinyl from 'vinyl';

import matcher = require('matcher');

import {jsTransform} from './js-transform';

// TODO(fks) 09-22-2016: Latest npm type declaration resolves to a non-module
// entity. Upgrade to proper JS import once compatible .d.ts file is released,
// or consider writing a custom declaration in the `custom_typings/` folder.
import File = require('vinyl');

const logger = logging.getLogger('cli.build.optimize-streams');

export type FileCB = (error?: any, file?: File) => void;
export type CSSOptimizeOptions = {
  stripWhitespace?: boolean;
};
export interface OptimizeOptions {
  html?: {
    minify?: boolean|{exclude?: string[]},
  };
  css?: {
    minify?: boolean|{exclude?: string[]},
  };
  js?: {
    minify?: boolean|{exclude?: string[]},
    compile?: boolean|{exclude?: string[]},
    moduleResolution?: ModuleResolutionStrategy,
    transformEsModulesToAmd?: boolean,
  };
}

/**
 * GenericOptimizeTransform is a generic optimization stream. It can be extended
 * to create a new kind of specific file-type optimizer, or it can be used
 * directly to create an ad-hoc optimization stream for different libraries.
 * If the transform library throws an exception when run, the file will pass
 * through unaffected.
 */
export class GenericOptimizeTransform extends Transform {
  optimizer: (content: string, file: File) => string;
  optimizerName: string;

  constructor(
      optimizerName: string,
      optimizer: (content: string, file: File) => string) {
    super({objectMode: true});
    this.optimizer = optimizer;
    this.optimizerName = optimizerName;
  }

  _transform(file: File, _encoding: string, callback: FileCB): void {
    // TODO(fks) 03-07-2017: This is a quick fix to make sure that
    // "webcomponentsjs" files aren't compiled down to ES5, because they contain
    // an important ES6 shim to make custom elements possible. Remove/refactor
    // when we have a better plan for excluding some files from optimization.
    if (!file.path || file.path.indexOf('webcomponentsjs/') >= 0 ||
        file.path.indexOf('webcomponentsjs\\') >= 0) {
      callback(null, file);
      return;
    }

    if (file.contents) {
      try {
        let contents = file.contents.toString();
        contents = this.optimizer(contents, file);
        file.contents = new Buffer(contents);
      } catch (error) {
        logger.warn(
            `${this.optimizerName}: Unable to optimize ${file.path}`,
            {err: error.message || error});
      }
    }
    callback(null, file);
  }
}

/**
 * Transform JavaScript using Babel.
 */
export class JsTransform extends GenericOptimizeTransform {
  constructor(options: OptimizeOptions['js']) {
    const shouldCompileFile =
        options.compile ? notExcluded(options.compile) : () => false;
    const shouldMinifyFile =
        options.minify ? notExcluded(options.minify) : () => false;

    const transformer = (content: string, file: File) => jsTransform(content, {
      compileToEs5: shouldCompileFile(file),
      minify: shouldMinifyFile(file),
      moduleResolution: options.moduleResolution,
      filePath: file.path,
      transformEsModulesToAmd: options.transformEsModulesToAmd,
    });

    super('babel-compile', transformer);
  }
}

/**
 * CSSMinifyTransform minifies CSS that pass through it (via css-slam).
 */
export class CSSMinifyTransform extends GenericOptimizeTransform {
  constructor(private options: CSSOptimizeOptions) {
    super('css-slam-minify', cssSlam.css);
  }

  _transform(file: File, encoding: string, callback: FileCB): void {
    // css-slam will only be run if the `stripWhitespace` option is true.
    if (this.options.stripWhitespace) {
      super._transform(file, encoding, callback);
    }
  }
}

/**
 * InlineCSSOptimizeTransform minifies inlined CSS (found in HTML files) that
 * passes through it (via css-slam).
 */
export class InlineCSSOptimizeTransform extends GenericOptimizeTransform {
  constructor(private options: CSSOptimizeOptions) {
    super('css-slam-inline', cssSlam.html);
  }

  _transform(file: File, encoding: string, callback: FileCB): void {
    // css-slam will only be run if the `stripWhitespace` option is true.
    if (this.options.stripWhitespace) {
      super._transform(file, encoding, callback);
    }
  }
}

/**
 * HTMLOptimizeTransform minifies HTML files that pass through it
 * (via html-minifier).
 */
export class HTMLOptimizeTransform extends GenericOptimizeTransform {
  constructor(options: HTMLMinifierOptions) {
    super('html-minify', (source: string) => htmlMinify(source, options));
  }
}

/**
 * Returns an array of optimization streams to use in your build, based on the
 * OptimizeOptions given.
 */
export function getOptimizeStreams(options?: OptimizeOptions):
    NodeJS.ReadWriteStream[] {
  options = options || {};
  const streams = [];

  // compile and/or minify ES6 JavaScript using babel
  if (options.js &&
      (options.js.compile || options.js.minify ||
       options.js.moduleResolution === 'node')) {
    streams.push(gulpif(matchesExt('.js'), new JsTransform(options.js)));
  }

  // minify code (minify should always be the last transform)
  if (options.html && options.html.minify) {
    streams.push(gulpif(
        matchesExtAndNotExcluded('.html', options.html.minify),
        new HTMLOptimizeTransform(
            {collapseWhitespace: true, removeComments: true})));
  }
  if (options.css && options.css.minify) {
    streams.push(gulpif(
        matchesExtAndNotExcluded('.css', options.css.minify),
        new CSSMinifyTransform({stripWhitespace: true})));
    // TODO(fks): Remove this InlineCSSOptimizeTransform stream once CSS
    // is properly being isolated by splitHtml() & rejoinHtml().
    streams.push(gulpif(
        matchesExtAndNotExcluded('.html', options.css.minify),
        new InlineCSSOptimizeTransform({stripWhitespace: true})));
  }

  return streams;
};

function matchesExt(extension: string) {
  return (fs: vinyl) => !!fs.path && fs.relative.endsWith(extension);
}

function notExcluded(option: boolean|{exclude?: string[]}) {
  const exclude = typeof option === 'object' && option.exclude || [];
  return (fs: vinyl) => !exclude.some(
             (pattern: string) => matcher.isMatch(fs.relative, pattern));
}
function matchesExtAndNotExcluded(
    extension: string, option: boolean|{exclude?: string[]}) {
  const a = matchesExt(extension);
  const b = notExcluded(option);
  return (fs: vinyl) => a(fs) && b(fs);
}
