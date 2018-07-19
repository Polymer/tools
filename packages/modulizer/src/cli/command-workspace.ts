/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';
import {Workspace} from 'polymer-workspaces';

import {CliOptions} from '../cli';
import convertWorkspace from '../convert-workspace';
import {saveDependencyMapping} from '../package-manifest';
import npmPublishWorkspace from '../publish-workspace';
import githubPushWorkspace from '../push-workspace';
import {testWorkspace, testWorkspaceInstallOnly} from '../test-workspace';
import {logStep} from '../util';

import {parseDependencyMappingInput} from './util';

const githubTokenMessage = `
You need to create a github token and place it in a file named 'github-token'.
The token does not need any permissions.

Generate a token here:   https://github.com/settings/tokens

Then:

echo 'PASTE TOKEN HEX HERE' > ./github-token
`;

/**
 * Post-Conversion steps that the user can select to run after workspace
 * conversion.
 */
enum PostConversionStep {
  Test = 'Install dependencies and run tests',
  TestInstallOnly = 'Install dependencies only',
  Push = 'Push changes to GitHub',
  Publish = 'Publish changes to npm',
  Exit = 'Exit',
}

/**
 * Create an array of post-conversion steps to run automatically from the given
 * CLI options. For example, when `--test` is provided the "test"
 * post-conversion step should be run without prompting.
 *
 * Steps should be run in the order returned.
 */
function postConversionStepsFromCliOptions(options: CliOptions):
    PostConversionStep[] {
  const steps = [];
  if (options.install === true) {
    steps.push(PostConversionStep.TestInstallOnly);
  }
  if (options.test === true) {
    steps.push(PostConversionStep.Test);
  }
  if (options.push === true) {
    steps.push(PostConversionStep.Push);
  }
  if (options.publish === true) {
    steps.push(PostConversionStep.Publish);
  }
  return steps;
}

/**
 * Checks for github-token in the RunnerOptions and if not specified, will look
 * in the github-token file in working folder.  If that doesn't exist either,
 * we message to the user that we need a token and exit the process.
 */
function loadGitHubToken(): string|null {
  // TODO(usergenic): Maybe support GITHUB_TOKEN as an environment variable,
  // since this would be a better solution for Travis deployments etc.
  const githubFilename = 'github-token';
  if (!fs.existsSync(githubFilename)) {
    console.error(`Missing file "${githubFilename}"`);
    return null;
  }
  try {
    return fs.readFileSync(githubFilename, 'utf8').trim();
  } catch (e) {
    console.error(`Unable to load file ${githubFilename}: ${e.message}`);
  }
  return null;
}


export default async function run(options: CliOptions) {
  const workspaceDir = path.resolve(options['workspace-dir']);
  logStep(1, 3, '🚧', `Setting Up Workspace "${workspaceDir}"...`);

  for (const rawMapping of options['dependency-mapping']) {
    try {
      const [bowerName, npmName, npmSemver] =
          parseDependencyMappingInput(rawMapping);
      saveDependencyMapping(bowerName, npmName, npmSemver);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  if (!options['npm-version']) {
    throw new Error('--npm-version required');
  }

  const npmPackageVersion = options['npm-version']!;
  const githubToken = options['github-token'] || loadGitHubToken();
  if (!githubToken) {
    console.log(githubTokenMessage);
    return;
  }

  const workspace = new Workspace({
    token: githubToken,
    dir: workspaceDir,
    match: options['repo']!,
    exclude: options['exclude'],
    fresh: options['clean'],
    verbose: true,
  });

  const {workspaceRepos: reposToConvert} = await workspace.init();

  await workspace.installBowerDependencies();

  logStep(2, 3, '🌀', `Converting ${reposToConvert.length} Package(s)...`);

  const convertedPackages = await convertWorkspace({
    workspaceDir,
    npmImportStyle: options['import-style'],
    packageVersion: npmPackageVersion,
    reposToConvert,
    deleteFiles: options['delete-files'],
    flat: options.flat,
    private: options.private,
    addImportMeta: options['add-import-meta'],
    excludes: options.exclude,
  });

  logStep(3, 3, '🎉', `Conversion Complete!`);

  // Loop indefinitely here so that we can control the function exit via the
  // user prompt.
  const todoConversionSteps = postConversionStepsFromCliOptions(options);
  while (true) {
    // Pull off a "to-do" post-conversion step if any were provided from the
    // command line, otherwise prompt the user for one.
    const stepSelection = todoConversionSteps.shift() ||
        (await inquirer.prompt([{
          type: 'list',
          name: 'post-conversion-step',
          message: 'What do you want to do now?',
          choices: Object.values(PostConversionStep),
        }]))['post-conversion-step'] as string;
    switch (stepSelection) {
      case PostConversionStep.Test:
        await testWorkspace(convertedPackages, {
          workspaceDir,
          packageVersion: npmPackageVersion,
          reposToConvert,
          flat: options.flat,
          private: options.private,
          importStyle: options['import-style'],
        });
        break;
      case PostConversionStep.TestInstallOnly:
        await testWorkspaceInstallOnly(convertedPackages, {
          workspaceDir,
          packageVersion: npmPackageVersion,
          reposToConvert,
          flat: options.flat,
          private: options.private,
          importStyle: options['import-style'],
        });
        break;
      case PostConversionStep.Push:
        await githubPushWorkspace(reposToConvert);
        break;
      case PostConversionStep.Publish:
        await npmPublishWorkspace(reposToConvert);
        break;
      case PostConversionStep.Exit:
        console.log('👋  Goodbye.');
        return;
      default:
        console.log(`ERR: option "${stepSelection}" not recognized`);
        break;
    }
  }
}
