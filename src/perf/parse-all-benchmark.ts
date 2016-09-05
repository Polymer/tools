/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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
import * as path from 'path';
import * as now from 'performance-now';

import {Analyzer} from '../analyzer';
import {FSUrlLoader} from '../url-loader/fs-url-loader';

import {Measurement} from './telemetry';

const bowerDir = path.resolve(__dirname, `../../bower_components`);
const analyzer = new Analyzer({urlLoader: new FSUrlLoader(bowerDir)});

const filesToAnalyze: string[] = [];

for (const baseDir of fs.readdirSync(bowerDir)) {
  const bowerJsonPath = path.join(bowerDir, baseDir, 'bower.json');
  let bowerJson: any;
  try {
    bowerJson = JSON.parse(fs.readFileSync(bowerJsonPath, 'utf-8'));
  } catch (e) {
    continue;
  }
  const main: string|string[] = bowerJson.main || [];
  const mains = Array.isArray(main) ? main : [main];
  for (const mainFile of mains) {
    if (existsSync(path.join(bowerDir, baseDir, mainFile))) {
      filesToAnalyze.push(path.join(baseDir, mainFile));
    }
  }
}


function existsSync(fn: string): boolean {
  try {
    fs.statSync(fn);
    return true;
  } catch (_) {
    return false;
  }
}

const fakeFileContents =
    filesToAnalyze.map((fn) => `<link rel="import" href="${fn}">`).join('\n');

function padLeft(str: string, num: number): string {
  if (str.length < num) {
    return padLeft(' ' + str, num);
  }
  return str;
}

async function measure() {
  const start = now();
  let document: any;
  for (let i = 0; i < 10; i++) {
    document = await analyzer.analyzeRoot('ephemeral.html', fakeFileContents);
  }

  const measurements = await analyzer.getTelemetryMeasurements();
  printMeasurements(measurements);

  console.log(`\n\n\n${document.getFeatures().size} total features resolved.`);
  console.log(
      `${((now() - start) / 1000).toFixed(2)} seconds total elapsed time`);
};

function printMeasurements(measurements: Measurement[]) {
  console.log(`\n\n\n\n
      The most important thing to benchmark is the resolve step, as everything
      else is cacheable. Here are times for resolving every element in the
      PolymerElements org.

      The total time for this benchmark will also include the initial parse and
      scan and so should be much much longer.
  `);
  const averager = new Averager<string>();
  console.log(`${padLeft('elapsed ms', 10)} - ${padLeft('operation', 30)}`);
  for (const m of measurements) {
    if (m.kind === 'Document.makeRootDocument') {
      console.log(
          `${padLeft(m.elapsedTime.toFixed(0), 10)} - ${padLeft(m.kind, 30)}`);
    }
    averager.addElapsed(m.kind, m.elapsedTime);
  }

  console.log('\n');
  console.log(`${padLeft('average ms', 10)} - ${padLeft('operation', 30)}`);
  for (const entry of averager.entries()) {
    console.log(
        `${padLeft(entry[1].toFixed(0), 10)} - ${padLeft(entry[0], 30)}`);
  }
}

class Counter<K> {
  private _map = new Map<K, number>();
  add(k: K, v?: number) {
    if (v == null) {
      v = 1;
    }
    let i = this._map.get(k) || 0;
    this._map.set(k, i + v);
  }

  get(k: K): number {
    return this._map.get(k);
  }

  keys(): K[] {
    return Array.from(this._map.keys());
  }
}
class Averager<K> {
  private count = new Counter<K>();
  private elapsed = new Counter<K>();

  addElapsed(k: K, elapsed: number) {
    this.count.add(k);
    this.elapsed.add(k, elapsed);
  }

  entries(): Iterable<[K, number]> {
    const entries = this.count.keys().map(
        (k) => <[K, number]>[k, this.elapsed.get(k) / this.count.get(k)]);
    return entries.sort((a, b) => a[1] - b[1]);
  }
}

measure().catch(((err) => console.log(err.stack) && process.exit(1)));
