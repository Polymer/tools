import { convertPackage } from './html2js';

import commandLineArgs = require('command-line-args')

const optionDefinitions: commandLineArgs.OptionDefinition[] = [
  { name: 'out', type: String, defaultValue: 'html2js_out'},
  { name: 'root-module', type: String },
  { name: 'exclude', type: String, multiple: true },
  { name: 'package-name', type: String},
  { name: 'npm-version', type: String},
];

export async function run() {

  const options = commandLineArgs(optionDefinitions);

  await convertPackage({
    outDir: options['out'],
    excludes: options['exclude'],
    rootModuleName: options['root-module'],
    packageName: options['package-name'],
    npmVersion: options['npm-version'],
  });

  console.log('done');
}
