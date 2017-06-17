import * as estree from 'estree';

declare module 'estree' {
  interface SourceLocation {
    source?: string;
    start: estree.Position;
    end: estree.Position;
  }

  interface Comment {
    loc?: SourceLocation;
  }
}
