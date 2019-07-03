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
import Generator = require('yeoman-generator');

export interface Props {
  name: string;
  elementName: string;
  description: string;
  elementClassName: string;
}

/**
 * Returns a Yeoman Generator constructor that can be passed to yeoman to be
 * run. A "template name" argument is required to choose the correct
 * `/templates` directory name to generate from.
 * (Ex: "polymer-2.x" to generate the `templates/polymer-2x` template directory)
 */
export function createApplicationGenerator(templateName: string):
    (typeof Generator) {
  class ApplicationGenerator extends Generator {
    props!: Props;

    constructor(args: string|string[], options: {}) {
      super(args, options);
      this.sourceRoot(
          path.join(__dirname, '../../../templates/application', templateName));
    }

    // This is necessary to prevent an exception in Yeoman when creating
    // storage for generators registered as a stub and used in a folder
    // with a package.json but with no name property.
    // https://github.com/Polymer/polymer-cli/issues/186
    rootGeneratorName(): string {
      return 'ApplicationGenerator';
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
          message: `Application name`,
          default: this.appname,
        },
        {
          type: 'input',
          name: 'elementName',
          message: `Main element name`,
          default: (answers: {}) => `${(answers as {name: string}).name}-app`,
          validate: (name: string) => {
            const nameContainsHyphen = name.includes('-');
            if (!nameContainsHyphen) {
              this.log(
                  '\nUh oh, custom elements must include a hyphen in ' +
                  'their name. Please try again.');
            }
            return nameContainsHyphen;
          },
        },
        {
          type: 'input',
          name: 'description',
          message: 'Brief description of the application',
        },
      ];

      this.props = (await this.prompt(prompts)) as Props;
      this.props.elementClassName = this.props.elementName.replace(
          /(^|-)(\w)/g,
          (_match: string, _p0: string, p1: string) => p1.toUpperCase());
    }

    writing() {
      const elementName = this.props.elementName;

      this.fs.copyTpl(
          `${this.templatePath()}/**/?(.)*`,
          this.destinationPath(),
          this.props,
          undefined,
          {globOptions: {ignore: ['**/_*']}});

      this.fs.copyTpl(
          this.templatePath('src/_element/_element.html'),
          `src/${elementName}/${elementName}.html`,
          this.props);

      this.fs.copyTpl(
          this.templatePath('test/_element/_element_test.html'),
          `test/${elementName}/${elementName}_test.html`,
          this.props);

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

  class Polymer3ApplicationGenerator extends ApplicationGenerator {
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
      const elementName = this.props.elementName;

      this.fs.copyTpl(
          `${this.templatePath()}/**/?(.)*`,
          this.destinationPath(),
          this.props,
          undefined,
          {globOptions: {ignore: ['**/_*']}});

      this.fs.copyTpl(
          this.templatePath('src/_element/_element.js'),
          `src/${elementName}/${elementName}.js`,
          this.props);

      this.fs.copyTpl(
          this.templatePath('test/_element/_element_test.html'),
          `test/${elementName}/${elementName}_test.html`,
          this.props);

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
      return Polymer3ApplicationGenerator;
    default:
      return ApplicationGenerator;
  }
}
