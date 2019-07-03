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
import {parse, ParsedLine} from './parsing.js';

export type FormattingFunction = (text: string) => string;
export interface FormattingOptions {
  showColumns?: boolean;
  // Methods are aligned up to this much padding.
  maxMethodPadding: number;
  // A string to prefix each line with.
  indent: string;
  // A string to show for stack lines that are missing a method.
  methodPlaceholder: string;
  // A list of Strings/RegExps that will be stripped from `location` values
  // on each line (via `String#replace`).
  locationStrip: (string|RegExp)[];
  // A list of Strings/RegExps that indicate that a line is *not* important,
  // and should be styled as such.
  unimportantLocation: Array<string>;
  // A filter function to completely remove lines
  filter: (line: ParsedLine) => boolean;
  // styles are functions that take a string and return
  // that string when styled.
  styles: {
    method: FormattingFunction; location: FormattingFunction;
    line: FormattingFunction;
    column: FormattingFunction;
    unimportant: FormattingFunction;
  };
}

export const defaults: FormattingOptions = {
  maxMethodPadding: 40,
  indent: '',
  methodPlaceholder: '<unknown>',
  locationStrip: [],
  unimportantLocation: [],
  filter: () => false,
  styles: {
    method: passthrough,
    location: passthrough,
    line: passthrough,
    column: passthrough,
    unimportant: passthrough,
  },
};

export function pretty(
    stackOrParsed: string|Array<ParsedLine|null>,
    maybeOptions?: Partial<FormattingOptions>): string {
  const options = mergeDefaults(maybeOptions || {}, defaults);
  const linesAndNulls =
      Array.isArray(stackOrParsed) ? stackOrParsed : parse(stackOrParsed);
  const lines = clean(linesAndNulls, options);

  const padSize = methodPadding(lines, options);
  const parts = lines.map((line) => {
    const method = line.method || options.methodPlaceholder;
    const pad = options.indent + padding(padSize - method.length);
    const locationBits = [
      options.styles.location(line.location),
      options.styles.line(line.line.toString()),
    ];
    if ('column' in line) {
      locationBits.push(options.styles.column(line.column.toString()));
    }
    const location = locationBits.join(':');
    let text = pad + options.styles.method(method) + ' at ' + location;
    if (!line.important) {
      text = options.styles.unimportant(text);
    }
    return text;
  });

  return parts.join('\n');
}

function clean(
    lines: Array<ParsedLine|null>, options: FormattingOptions): ParsedLine[] {
  const result: ParsedLine[] = [];
  for (let i = 0, line; line = lines[i]; i++) {
    if (options.filter && options.filter(line)) {
      continue;
    }
    line.location = cleanLocation(line.location, options);
    line.important = isImportant(line, options);
    result.push(line);
  }

  return result;
}

// Utility

function passthrough(text: string): string {
  return text;
}

function mergeDefaults<V extends {}>(options: Partial<V>, defaults: V): V {
  const result = Object.create(defaults);
  Object.keys(options).forEach((untypedKey) => {
    const key = untypedKey as keyof typeof options;
    let value = options[key];
    if (typeof value === 'object' && !Array.isArray(value)) {
      value =
          mergeDefaults(value as typeof defaults[typeof key], defaults[key]);
    }
    result[key] = value;
  });
  return result;
}

function methodPadding(
    lines: Array<ParsedLine|null>, options: FormattingOptions) {
  let size = (options.methodPlaceholder || '').length;
  for (let i = 0, line; line = lines[i]; i++) {
    size = Math.min(
        options.maxMethodPadding || Infinity,
        Math.max(size, line.method.length));
  }
  return size;
}

function padding(length: number) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result = result + ' ';
  }
  return result;
}

function cleanLocation(location: string, options: FormattingOptions) {
  if (options.locationStrip) {
    for (let i = 0, matcher; matcher = options.locationStrip[i]; i++) {
      location = location.replace(matcher, '');
    }
  }

  return location;
}

function isImportant(line: ParsedLine, options: FormattingOptions) {
  if (options.unimportantLocation) {
    for (let i = 0, matcher; matcher = options.unimportantLocation[i]; i++) {
      if (line.location.match(matcher)) {
        return false;
      }
    }
  }

  return true;
}
