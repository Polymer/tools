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

// Be careful with these imports. As many as possible should be dynamic imports
// in the run method in order to minimize startup time from loading unused code.

import {ProjectConfig} from 'polymer-project-config';

import {Command, CommandOptions} from './command';

export class InstallCommand implements Command {
  name = 'install';
  aliases = ['i'];

  // TODO(justinfagnani): Expand and link to eventual doc on variants.
  description = 'Installs project dependencies from npm or Bower (optionally ' +
      'installing "variants").';

  args = [
    {
      name: 'variants',
      type: Boolean,
      defaultValue: false,
      description: 'Whether to install Bower variants'
    },
    {
      name: 'offline',
      type: Boolean,
      defaultValue: false,
      description: 'Don\'t hit the network when installing Bower dependencies'
    },
  ];

  async run(options: CommandOptions, config: ProjectConfig): Promise<void> {
    const install = (await import('../install/install')).install;

    // Use `npm` from the config, if available and not passed as a CLI arg.
    if (options.npm === undefined && config.npm !== undefined) {
      options.npm = config.npm;
    }

    await install(options);
  }
}
