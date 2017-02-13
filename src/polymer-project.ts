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

import * as logging from 'plylog';
import {ProjectConfig, ProjectOptions} from 'polymer-project-config';
import {src as vinylSrc} from 'vinyl-fs';

import {BuildAnalyzer} from './analyzer';
import {BuildBundler} from './bundle';

const logger = logging.getLogger('polymer-project');


export class PolymerProject {
  config: ProjectConfig;

  /**
   * A `Transform` stream that uses polymer-analyzer to analyze the files. It
   * can be used to get information on dependencies and fragments for the
   * project once the source & dependency streams have been piped into it.
   */
  analyzer: BuildAnalyzer;

  /**
   * A `Transform` stream that modifies the files that pass through it based
   * on the dependency analysis done by the `analyzer` transform. It "bundles"
   * a project by injecting its dependencies into the application fragments
   * themselves, so that a minimum number of requests need to be made to load.
   *
   * (NOTE: The analyzer stream must be in the pipeline somewhere before this.)
   */
  bundler: BuildBundler;

  constructor(config: ProjectConfig|ProjectOptions|string) {
    if (config.constructor.name === 'ProjectConfig') {
      this.config = <ProjectConfig>config;
    } else if (typeof config === 'string') {
      this.config = ProjectConfig.loadConfigFromFile(config);
    } else {
      this.config = new ProjectConfig(config);
    }

    logger.debug(`build config loaded:`, this.config);

    this.analyzer = new BuildAnalyzer(this.config);
    this.bundler = new BuildBundler(this.config, this.analyzer);
  }

  /**
   * Returns the analyzer's stream of this project's source files - files
   * matched by the project's `config.sources` value.
   */
  sources(): NodeJS.ReadableStream {
    return this.analyzer.sources();
  }

  /**
   * Returns the analyzer's stream of this project's dependency files - files
   * loaded inside the analyzed project that are not considered source files.
   */
  dependencies(): NodeJS.ReadableStream {
    let dependenciesStream: NodeJS.ReadableStream =
        this.analyzer.dependencies();

    // If we need to include additional dependencies, create a new vinyl source
    // stream and pipe our default dependencyStream through it to combine.
    if (this.config.extraDependencies.length > 0) {
      const includeStream = vinylSrc(this.config.extraDependencies, {
        cwdbase: true,
        nodir: true,
        passthrough: true,
      });
      dependenciesStream = dependenciesStream.pipe(includeStream);
    }

    return dependenciesStream;
  }
}
