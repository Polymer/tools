// Delete this once https://github.com/paulja/memory-streams-js/pull/7 lands.

declare module 'memory-streams' {
  import {Readable, Writable} from 'stream';

  export class ReadableStream extends Readable {
    constructor(contents: string);
  }

  export class WritableStream extends Writable {}
}
