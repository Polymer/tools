/*
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

import * as chalk from 'chalk';
import * as path from 'path';
import * as logging from 'plylog';
import Generator = require('yeoman-generator');
import validateElementName = require('validate-element-name');

const logger = logging.getLogger('init');

export interface Props {
  name: string;
  elementClassName: string;
}

/**
 * Returns a Yeoman Generator constructor that can be passed to yeoman to be
 * run. A "template name" argument is required to choose the correct
 * `/templates` directory name to generate from.
 * (Ex: "polymer-2.x" to generate the `templates/polymer-2x` template directory)
 */
export function createElementGenerator(templateName: string):
    (typeof Generator) {
  class ElementGenerator extends Generator {
    props!: Props;

    constructor(args: string|string[], options: {}) {
      super(args, options);
      this.sourceRoot(
          path.join(__dirname, '../../../templates/element', templateName));
    }

    // This is necessary to prevent an exception in Yeoman when creating
    // storage for generators registered as a stub and used in a folder
    // with a package.json but with no name property.
    // https://github.com/Polymer/polymer-cli/issues/186
    rootGeneratorName(): string {
      return 'ElementGenerator';
    }

    initializing() {
      // Yeoman replaces dashes with spaces. We want dashes.
      this.appname = this.appname.replace(/\s+/g, '-');
    }

    async prompting(): Promise<void> {
      const prompts = [
        {
          name: 'name',
          type: 'input',
          message: `Element name`,
          default:
              this.appname + (this.appname.includes('-') ? '' : '-element'),
          validate: (name: string) => {
            const nameValidation = validateElementName(name);

            if (!nameValidation.isValid) {
              this.log(`\n${nameValidation.message}\nPlease try again.`);
            } else if (nameValidation.message) {
              this.log('');  // 'empty' log inserts a line break
              logger.warn(nameValidation.message);
            }

            return nameValidation.isValid;
          },
        },
        {
          type: 'input',
          name: 'description',
          message: 'Brief description of the element',
        },
      ];

      this.props = (await this.prompt(prompts)) as Props;
      this.props.elementClassName = this.props.name.replace(
          /(^|-)(\w)/g,
          (_match: string, _p0: string, p1: string) => p1.toUpperCase());
    }

    writing() {
      const name = this.props.name;

      this.fs.copyTpl(
          `${this.templatePath()}/**/?(.)*`,
          this.destinationPath(),
          this.props,
          undefined,
          {globOptions: {ignore: ['**/_*']}});

      this.fs.copyTpl(
          this.templatePath('_element.html'), `${name}.html`, this.props);

      this.fs.copyTpl(
          this.templatePath('test/_element_test.html'),
          `test/${name}_test.html`,
          this.props);

      this.fs.copyTpl(
          this.templatePath('test/index.html'), `test/index.html`, this.props);

      this.fs.move(
          this.destinationPath('gitignore'),
          this.destinationPath('.gitignore'));
    }

    install() {
      this.log(chalk.bold('\nProject generated!'));
      this.log('Installing dependencies...');
      this.installDependencies({
        npm: false,
      });
    }

    end() {
      this.log(chalk.bold('\nSetup Complete!'));
      this.log(
          'Check out your new project README for information about what to do next.\n');
    }
  }

  class Polymer3ElementGenerator extends ElementGenerator {
    // TODO(yeoman/generator#1065): This function is not a no-op: Yeoman only
    // checks the object's prototype's own properties for generator task
    // methods. http://yeoman.io/authoring/running-context.html
    initializing() {
      return super.initializing();
    }

    // TODO(yeoman/generator#1065): This function is not a no-op: Yeoman only
    // checks the object's prototype's own properties for generator task
    // methods. http://yeoman.io/authoring/running-context.html
    async prompting() {
      return super.prompting();
    }

    writing() {
      const name = this.props.name;

      this.fs.copyTpl(
          `${this.templatePath()}/**/?(.)*`,
          this.destinationPath(),
          this.props,
          undefined,
          {globOptions: {ignore: ['**/_*']}});

      this.fs.copyTpl(
          this.templatePath('_element.js'), `${name}.js`, this.props);

      this.fs.copyTpl(
          this.templatePath('test/_element_test.html'),
          `test/${name}_test.html`,
          this.props);

      this.fs.copyTpl(
          this.templatePath('test/index.html'), `test/index.html`, this.props);

      this.fs.move(
          this.destinationPath('gitignore'),
          this.destinationPath('.gitignore'));
    }

    install() {
      this.log(chalk.bold('\nProject generated!'));
      this.log('Installing dependencies...');
      this.installDependencies({
        bower: false,
        npm: true,
      });
    }

    // TODO(yeoman/generator#1065): This function is not a no-op: Yeoman only
    // checks the object's prototype's own properties for generator task
    // methods. http://yeoman.io/authoring/running-context.html
    end() {
      return super.end();
    }
  }

  switch (templateName) {
    case 'polymer-3.x':
      return Polymer3ElementGenerator;
    default:
      return ElementGenerator;
  }
}
