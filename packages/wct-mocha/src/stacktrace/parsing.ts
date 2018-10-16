/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 *
 * This code may only be used under the BSD style license found at
 * polymer.github.io/LICENSE.txt The complete set of authors may be found at
 * polymer.github.io/AUTHORS.txt The complete set of contributors may be found
 * at polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as part of
 * the polymer project is also subject to an additional IP rights grant found at
 * polymer.github.io/PATENTS.txt
 */

export interface ParsedLine {
  method: string;
  location: string;
  line: number;
  column: number;
  important?: boolean;
}

export function parse(stack: string) {
  const rawLines = stack.split('\n');

  const stackyLines = compact(rawLines.map(parseStackyLine));
  if (stackyLines.length === rawLines.length) {
    return stackyLines;
  }

  const v8Lines = compact(rawLines.map(parseV8Line));
  if (v8Lines.length > 0) {
    return v8Lines;
  }

  const geckoLines = compact(rawLines.map(parseGeckoLine));
  if (geckoLines.length > 0) {
    return geckoLines;
  }

  throw new Error('Unknown stack format: ' + stack);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack
const GECKO_LINE = /^(?:([^@]*)@)?(.*?):(\d+)(?::(\d+))?$/;

export function parseGeckoLine(line: string): ParsedLine {
  const match = line.match(GECKO_LINE);
  if (!match) {
    return null;
  }
  return {
    method: match[1] || '',
    location: match[2] || '',
    line: parseInt(match[3]) || 0,
    column: parseInt(match[4]) || 0,
  };
}

// https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
const V8_OUTER1 = /^\s*(eval )?at (.*) \((.*)\)$/;
const V8_OUTER2 = /^\s*at()() (\S+)$/;
const V8_INNER = /^\(?([^\(]+):(\d+):(\d+)\)?$/;

export function parseV8Line(line: string): ParsedLine {
  const outer = line.match(V8_OUTER1) || line.match(V8_OUTER2);
  if (!outer) {
    return null;
  }
  const inner = outer[3].match(V8_INNER);
  if (!inner) {
    return null;
  }
  let method = outer[2] || '';
  if (outer[1]) {
    method = 'eval at ' + method;
  }
  return {
    method: method,
    location: inner[1] || '',
    line: parseInt(inner[2]) || 0,
    column: parseInt(inner[3]) || 0,
  };
}

const STACKY_LINE = /^\s*(.+) at (.+):(\d+):(\d+)$/;

export function parseStackyLine(line: string): ParsedLine {
  const match = line.match(STACKY_LINE);
  if (!match) {
    return null;
  }
  return {
    method: match[1] || '',
    location: match[2] || '',
    line: parseInt(match[3]) || 0,
    column: parseInt(match[4]) || 0,
  };
}

// Helpers

function compact<T>(array: Array<T>) {
  const result: Array<T> = [];
  array.forEach((value) => value && result.push(value));
  return result;
}
