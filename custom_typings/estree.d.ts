import * as estree from 'estree';

declare module 'estree' {
  interface Comment {
    loc?: SourceLocation;
  }
}
